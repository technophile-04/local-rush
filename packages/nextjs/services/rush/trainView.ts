import { type Address, createPublicClient, http, zeroAddress } from "viem";
import { base } from "viem/chains";
import { rushContract } from "~~/services/rush/contract";
import type { Rider, Ticket, TrainView } from "~~/types/rush";

export const baseReadClient = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL || "https://mainnet.base.org"),
});

// A departed train's riders never change, so each one is read once per server instance.
const departedRiders = new Map<bigint, Promise<Rider[]>>();

async function readRiders(trainId: bigint, blockNumber: bigint): Promise<Rider[]> {
  const riders = await baseReadClient.readContract({
    ...rushContract,
    functionName: "getRiders",
    args: [trainId],
    blockNumber,
  });
  return riders.map(({ rider, ...rest }) => ({ address: rider, ...rest }));
}

function readDepartedRiders(trainId: bigint, blockNumber: bigint) {
  let riders = departedRiders.get(trainId);
  if (!riders) {
    riders = readRiders(trainId, blockNumber);
    departedRiders.set(trainId, riders);
    riders.catch(() => departedRiders.delete(trainId));
  }
  return riders;
}

async function readTrain(): Promise<TrainView> {
  // Read every call at one block so a departure cannot mix two trains' state.
  const blockNumber = await baseReadClient.getBlockNumber({ cacheTime: 0 });
  const state = await baseReadClient.readContract({ ...rushContract, functionName: "status", blockNumber });
  const [riders, riderList] = await Promise.all([
    readRiders(state.trainId, blockNumber),
    state.lastDepartedTrainId === 0n ? undefined : readDepartedRiders(state.lastDepartedTrainId, blockNumber),
  ]);
  return {
    trainId: state.trainId,
    destination: state.destination,
    virarFast: state.virarFast,
    capacity: state.capacity,
    teamworkFrom: Number(state.teamworkFrom),
    firstBoardAt: Number(state.firstBoardAt),
    departsAt: Number(state.departsAt),
    riders,
    doorHanger:
      state.doorHanger === zeroAddress
        ? null
        : { address: state.doorHanger, name: state.doorHangerName, until: Number(state.doorHangUntil) },
    lastDeparted:
      state.lastDepartedTrainId === 0n
        ? null
        : { trainId: state.lastDepartedTrainId, riders: Number(state.lastDepartedRiders), riderList },
  };
}

let trainRead: { expires: number; value: Promise<TrainView> } | undefined;

export function getTrainView() {
  // Coalesce concurrent requests even on a cold edge cache or local dev server.
  if (trainRead && trainRead.expires > Date.now()) return trainRead.value;
  const value = readTrain();
  trainRead = { expires: Infinity, value };
  void value.then(
    () => {
      if (trainRead?.value === value) trainRead.expires = Date.now() + 1_000;
    },
    () => {
      if (trainRead?.value === value) trainRead = undefined;
    },
  );
  return value;
}

type TicketDetails = Omit<Ticket, "tokenId" | "held">;

// A ticket's train, seat and artwork never change; only its owner does.
const ticketDetails = new Map<bigint, TicketDetails>();

async function readTicketDetails(tokenIds: readonly bigint[]) {
  const missing = tokenIds.filter(tokenId => !ticketDetails.has(tokenId));
  if (!missing.length) return;
  console.log(`[tickets] reading tickets and tokenURI for ${missing.length} uncached token(s)`);
  const [tickets, uris] = await Promise.all([
    baseReadClient.multicall({
      allowFailure: false,
      contracts: missing.map(tokenId => ({ ...rushContract, functionName: "tickets", args: [tokenId] }) as const),
    }),
    baseReadClient.multicall({
      allowFailure: false,
      contracts: missing.map(tokenId => ({ ...rushContract, functionName: "tokenURI", args: [tokenId] }) as const),
    }),
  ]);
  missing.forEach((tokenId, index) => {
    const [trainId, seat] = tickets[index];
    const metadata = JSON.parse(Buffer.from(uris[index].split(",")[1], "base64").toString("utf8")) as {
      image?: unknown;
      attributes?: { trait_type?: unknown; value?: unknown }[];
    };
    const trait = (name: string) =>
      Array.isArray(metadata.attributes) ? metadata.attributes.find(a => a?.trait_type === name)?.value : undefined;
    const textTrait = (name: string) => {
      const value = trait(name);
      return typeof value === "string" ? value : undefined;
    };
    const boolTrait = (name: string) => {
      const value = trait(name);
      return typeof value === "boolean" ? value : undefined;
    };
    const mahim = textTrait("Mahim");
    ticketDetails.set(tokenId, {
      trainId,
      seat,
      image: typeof metadata.image === "string" ? metadata.image : undefined,
      destination: textTrait("Destination"),
      crowd: textTrait("Crowd"),
      teamwork: boolTrait("Teamwork Push"),
      // The contract writes "Bhai, Mahim nahi!" for riders who flew off, "Made it past Mahim" otherwise.
      mahim: mahim === undefined ? undefined : mahim.startsWith("Bhai"),
      virarFast: boolTrait("Virar Fast"),
    });
  });
}

export async function getTickets(rider: Address): Promise<Ticket[]> {
  const tokenIds = await baseReadClient.readContract({ ...rushContract, functionName: "ridesOf", args: [rider] });
  if (!tokenIds.length) return [];
  const [owners] = await Promise.all([
    baseReadClient.multicall({
      allowFailure: false,
      contracts: tokenIds.map(tokenId => ({ ...rushContract, functionName: "ownerOf", args: [tokenId] }) as const),
    }),
    readTicketDetails(tokenIds),
  ]);
  return tokenIds.map((tokenId, index) => ({
    tokenId,
    ...ticketDetails.get(tokenId)!,
    held: owners[index].toLowerCase() === rider.toLowerCase(),
  }));
}

export function jsonWithBigInts(value: unknown) {
  return JSON.stringify(value, (_, item) => (typeof item === "bigint" ? item.toString() : item));
}
