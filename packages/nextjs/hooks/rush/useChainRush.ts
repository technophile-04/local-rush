"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createPublicClient, encodeFunctionData, http, isAddress } from "viem";
import { waitForCallsStatus } from "viem/actions";
import { base } from "viem/chains";
import { useAccount, useCapabilities, useConfig, useConnect, useDisconnect, useSendCalls, useSwitchChain } from "wagmi";
import { getConnectorClient } from "wagmi/actions";
import { sameAddress } from "~~/components/rush/rush";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { rushContract } from "~~/services/rush/contract";
import { fetchFeed, fetchStats, parseTickets, parseTrainView } from "~~/services/rush/feed";
import { loadQuickTicket } from "~~/services/rush/quickTicket";
import {
  getLoginMethod,
  getServerLoginMethod,
  restoreLoginMethod,
  setLoginMethod,
  subscribeLoginMethod,
} from "~~/services/rush/session";
import {
  type RushCall,
  decodePushResult,
  runRushAction,
  rushError,
  sendRiderCall,
  validateName,
} from "~~/services/rush/sponsoredCall";
import type { LoginMethod, RushSource } from "~~/types/rush";

const quickReadClient = createPublicClient({
  chain: base,
  transport: http(
    process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
      ? `https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
      : "https://mainnet.base.org",
  ),
});
const quickTicketQueryKey = ["rush", "quickTicket"];

export function useChainRush(): RushSource {
  const queryClient = useQueryClient();
  const config = useConfig();
  const wallet = useAccount();
  const { connectors, connectAsync } = useConnect();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();
  const { switchChainAsync } = useSwitchChain();
  const { sendCallsAsync } = useSendCalls();
  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "LocalRush", chainId: base.id });
  const method = useSyncExternalStore(subscribeLoginMethod, getLoginMethod, getServerLoginMethod);
  useEffect(restoreLoginMethod, []);

  const quickQuery = {
    queryKey: quickTicketQueryKey,
    queryFn: () => loadQuickTicket(quickReadClient, localStorage),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  };
  const quick = useQuery({ ...quickQuery, enabled: method === "burner" });
  const address = method === "burner" ? quick.data?.address : method ? wallet.address : undefined;
  const status =
    method === "burner"
      ? quick.data
        ? "ready"
        : quick.isError
          ? "disconnected"
          : "connecting"
      : method && wallet.isConnected
        ? "ready"
        : wallet.isConnecting || wallet.isReconnecting
          ? "connecting"
          : "disconnected";
  const { data: capabilities } = useCapabilities({
    account: wallet.address,
    chainId: base.id,
    query: { enabled: method !== "burner" && !!method && wallet.isConnected },
  });
  const train = useQuery({
    queryKey: ["rush", "train"],
    queryFn: async () => parseTrainView(await fetchFeed("/api/train")),
    refetchInterval: 1_000,
  });
  const ponderUrl = process.env.NEXT_PUBLIC_PONDER_URL;
  const stats = useQuery({
    queryKey: ["rush", "stats", ponderUrl],
    queryFn: () => (ponderUrl ? fetchStats(ponderUrl) : null),
    enabled: !!ponderUrl,
    refetchInterval: 10_000,
  });
  // Tickets change only through this phone's own calls or a teamwork push, so they refresh on those
  // and otherwise poll slowly; every phone polling fast would multiply RPC reads.
  const tickets = useQuery({
    queryKey: ["rush", "tickets", address],
    queryFn: async () => parseTickets(await fetchFeed(`/api/tickets?rider=${address}`)),
    enabled: status === "ready" && !!address,
    refetchInterval: 30_000,
  });
  const hanging = !!train.data?.doorHanger && sameAddress(train.data.doorHanger.address, address);
  const wasHanging = useRef(false);
  useEffect(() => {
    // A door hanger's ticket is minted by someone else's push, so refresh once the hang resolves.
    if (wasHanging.current && !hanging) void queryClient.invalidateQueries({ queryKey: ["rush", "tickets"] });
    wasHanging.current = hanging;
  }, [hanging, queryClient]);

  async function login(next: LoginMethod) {
    try {
      if (next === "passkey") {
        const connector = connectors.find(candidate => candidate.id === "baseAccount");
        if (!connector) throw new Error("Passkey login is unavailable. Try a quick ticket.");
        // Start the popup in the click handler before awaiting or doing storage work.
        const connecting = connectAsync({ connector, chainId: base.id });
        setLoginMethod(next);
        await connecting;
      } else if (next === "wallet") {
        if (!openConnectModal) throw new Error("Wallet login is unavailable. Try a quick ticket.");
        setLoginMethod(next);
        openConnectModal();
      } else {
        setLoginMethod(next);
        await queryClient.fetchQuery(quickQuery);
      }
    } catch (error) {
      if (getLoginMethod() === next) setLoginMethod(null);
      throw rushError(error);
    }
  }

  async function send(call: RushCall, paid: () => ReturnType<typeof writeContractAsync>) {
    if (status !== "ready" || !address || !method) throw new Error("Choose a rider account first.");
    if (method !== "burner" && wallet.chainId !== base.id) {
      await switchChainAsync({ chainId: base.id });
      // The Scaffold write hook needs the next render to observe the new chain.
      throw new Error("Your wallet is now on Base. Try your call again.");
    }
    return sendRiderCall({
      method,
      account: quick.data,
      client: quickReadClient,
      call,
      origin: location.origin,
      supportsSponsor: capabilities?.paymasterService?.supported === true,
      sendPaid: paid,
      async sendSponsored(call, url) {
        const { id } = await sendCallsAsync({
          chainId: base.id,
          calls: [call],
          capabilities: { paymasterService: { url } },
        });
        const client = await getConnectorClient(config, { chainId: base.id });
        const result = await waitForCallsStatus(client, { id, throwOnFailure: true, timeout: 120_000 });
        if (result.status !== "success") throw new Error("The call failed. Please try again.");
        return result.receipts?.flatMap(receipt => receipt.logs) ?? [];
      },
    });
  }

  function execute<T>(action: () => Promise<T>) {
    return runRushAction(action, () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["rush", "train"] }),
        queryClient.invalidateQueries({ queryKey: ["rush", "tickets"] }),
      ]),
    );
  }

  return {
    train: train.data ?? null,
    stats: stats.data ?? null,
    session: {
      status,
      method,
      address,
      login,
      logout() {
        setLoginMethod(null);
        disconnect();
      },
    },
    actions: {
      tickets: status === "ready" ? (tickets.data ?? []) : [],
      push: name =>
        execute(async () => {
          validateName(name);
          if (!address || !isAddress(address)) throw new Error("Choose a rider account first.");
          const data = encodeFunctionData({ abi: rushContract.abi, functionName: "push", args: [name] });
          const logs = await send({ to: rushContract.address, data }, () =>
            writeContractAsync({ functionName: "push", args: [name] }),
          );
          return decodePushResult(logs, address);
        }),
      sendTicket: (tokenId, to) =>
        execute(async () => {
          if (!isAddress(to)) throw new Error("Enter a valid wallet address for your ticket.");
          if (!address || !isAddress(address)) throw new Error("Choose a rider account first.");
          const args = [address, to, tokenId] as const;
          const data = encodeFunctionData({ abi: rushContract.abi, functionName: "transferFrom", args });
          await send({ to: rushContract.address, data }, () =>
            writeContractAsync({ functionName: "transferFrom", args }),
          );
        }),
    },
  };
}
