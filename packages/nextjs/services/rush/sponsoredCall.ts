import { type Address, type Hex, type Log, parseEventLogs, toFunctionSelector } from "viem";
import { http } from "viem";
import { createBundlerClient } from "viem/account-abstraction";
import { waitForTransactionReceipt } from "viem/actions";
import { base } from "viem/chains";
import { rushContract } from "~~/services/rush/contract";
import { type QuickTicketClient, createQuickTicket } from "~~/services/rush/quickTicket";
import type { LoginMethod, PushResult } from "~~/types/rush";
import { getParsedError, notification } from "~~/utils/scaffold-eth";

export type RushCall = { to: Address; data: Hex };
export type RushLog = { address: Address; data: Hex; topics: readonly Hex[] };
export type QuickTicketAccount = Awaited<ReturnType<typeof createQuickTicket>>;

export async function sendRiderCall({
  method,
  account,
  client,
  call,
  origin,
  supportsSponsor,
  sendSponsored,
  sendPaid,
}: {
  method: LoginMethod;
  account?: QuickTicketAccount;
  client: QuickTicketClient;
  call: RushCall;
  origin: string;
  supportsSponsor: boolean;
  sendSponsored: (call: RushCall, url: string) => Promise<RushLog[]>;
  sendPaid: () => Promise<Hex | undefined>;
}) {
  if (method === "burner") {
    if (!account) throw new Error("Your quick ticket is still loading.");
    return sendQuickCall({ account, client, call, origin });
  }
  if (method === "passkey" || supportsSponsor) return sendSponsored(call, walletSponsorUrl(origin));
  notification.info("This wallet pays Base gas, usually a few cents. A quick ticket or passkey uses sponsored gas.");
  const hash = await sendPaid();
  if (!hash) throw new Error("The call was not sent. Check that your wallet is connected to Base.");
  const receipt = await waitForTransactionReceipt(client, { hash });
  if (receipt.status !== "success") throw new Error("The call failed. Please try again.");
  return receipt.logs;
}

let sending = false;

export async function runRushAction<T>(action: () => Promise<T>, refresh: () => Promise<unknown>) {
  if (sending) throw new Error("Your last call is still pending. Wait for it to finish.");
  sending = true;
  try {
    const result = await action();
    await refresh();
    return result;
  } catch (error) {
    throw rushError(error);
  } finally {
    sending = false;
  }
}

export function walletSponsorUrl(origin: string) {
  const url = new URL("/api/paymaster", origin);
  if (url.protocol !== "https:") throw new Error("Passkey sponsorship needs this app's HTTPS address.");
  return url.href;
}

export async function sendQuickCall({
  account,
  client,
  call,
  origin,
}: {
  account: QuickTicketAccount;
  client: QuickTicketClient;
  call: RushCall;
  origin: string;
}) {
  const bundler = createBundlerClient({
    account,
    client,
    chain: base,
    paymaster: true,
    transport: http(new URL("/api/paymaster", origin).href),
  });
  const hash = await bundler.sendUserOperation({ calls: [call] });
  const result = await bundler.waitForUserOperationReceipt({ hash, timeout: 120_000 });
  if (!result.success) throw new Error(result.reason || "The call failed. Please try again.");
  return result.logs;
}

export function validateName(name: string) {
  if (!name.trim()) throw new Error("Enter your name before you push.");
  if (new TextEncoder().encode(name).length > 20) {
    throw new Error("Keep your name within 20 bytes. Marathi letters use 3 bytes each.");
  }
}

export function decodePushResult(logs: readonly RushLog[], rider: Address): PushResult {
  const events = parseEventLogs({
    abi: rushContract.abi,
    eventName: ["Boarded", "DoorHanging"],
    logs: logs
      .filter(log => log.address.toLowerCase() === rushContract.address.toLowerCase())
      .map(log => {
        const [first, ...rest] = log.topics;
        return {
          ...log,
          topics: first ? [first, ...rest] : [],
          blockHash: null,
          blockNumber: null,
          transactionHash: null,
          transactionIndex: null,
          logIndex: null,
          removed: false,
        } satisfies Log;
      }),
  });
  for (const event of events) {
    if (event.args.rider.toLowerCase() !== rider.toLowerCase()) continue;
    if (event.eventName === "Boarded") {
      const { trainId, tokenId, seat, teamwork } = event.args;
      return { kind: "boarded", trainId, tokenId, seat, teamwork };
    }
    return { kind: "hanging", trainId: event.args.trainId, until: Number(event.args.until) };
  }
  throw new Error("Your push was confirmed, but its boarding result is missing. Check the train and your tickets.");
}

export function rushError(error: unknown) {
  const message = getParsedError(error);
  const details = `${message} ${error instanceof Error ? error.message : ""}`;
  const errors = [
    ["AlreadyOnTrain", "You are already on this train. Wait for the next one."],
    ["StillHanging", "You are still at the door. Wait for another commuter to push."],
    ["BadName", "Enter a name within 20 UTF-8 bytes."],
  ];
  for (const [name, friendly] of errors) {
    if (details.includes(name) || details.includes(toFunctionSelector(`${name}()`))) return new Error(friendly);
  }
  if (details.includes("Gas sponsor not configured"))
    return new Error("Free pushes are not ready yet. Try again shortly.");
  return new Error(message);
}
