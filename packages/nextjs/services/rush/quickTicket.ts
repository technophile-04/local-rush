import { type Hex } from "viem";
import { toCoinbaseSmartAccount } from "viem/account-abstraction";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const QUICK_TICKET_KEY = "rush.quickTicket.pk";
export type QuickTicketClient = Parameters<typeof toCoinbaseSmartAccount>[0]["client"];

export function createQuickTicket(client: QuickTicketClient, privateKey: Hex) {
  // The version fixes the account address. Changing it strands existing tickets.
  return toCoinbaseSmartAccount({ client, owners: [privateKeyToAccount(privateKey)], version: "1.1" });
}

export function loadQuickTicket(client: QuickTicketClient, storage: Pick<Storage, "getItem" | "setItem">) {
  const stored = storage.getItem(QUICK_TICKET_KEY);
  if (stored !== null && !/^0x[0-9a-fA-F]{64}$/.test(stored)) {
    throw new Error("This phone's quick ticket key is damaged. Keep its saved data and ask for help.");
  }
  const privateKey = stored === null ? generatePrivateKey() : stored;
  if (!privateKey.startsWith("0x")) throw new Error("Invalid quick ticket key.");
  // The saved value passed the hex check above; viem also checks the curve's key range.
  const key = privateKey as Hex;
  if (stored === null) storage.setItem(QUICK_TICKET_KEY, key);
  return createQuickTicket(client, key);
}
