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

export async function getTickets(rider: Address): Promise<Ticket[]> {
  const tokenIds = await baseReadClient.readContract({ ...rushContract, functionName: "ridesOf", args: [rider] });
  if (!tokenIds.length) return [];
  const tickets = await baseReadClient.multicall({
    allowFailure: false,
    contracts: tokenIds.map(tokenId => ({ ...rushContract, functionName: "tickets", args: [tokenId] }) as const),
  });
  const owners = await baseReadClient.multicall({
    allowFailure: false,
    contracts: tokenIds.map(tokenId => ({ ...rushContract, functionName: "ownerOf", args: [tokenId] }) as const),
  });
  const uris = await baseReadClient.multicall({
    allowFailure: false,
    contracts: tokenIds.map(tokenId => ({ ...rushContract, functionName: "tokenURI", args: [tokenId] }) as const),
  });
  return tokenIds.map((tokenId, index) => {
    const [trainId, seat] = tickets[index];
    const metadata: unknown = JSON.parse(Buffer.from(uris[index].split(",")[1], "base64").toString("utf8"));
    const image =
      typeof metadata === "object" && metadata !== null && "image" in metadata && typeof metadata.image === "string"
        ? metadata.image
        : undefined;
    return { tokenId, trainId, seat, held: owners[index].toLowerCase() === rider.toLowerCase(), image };
  });
}

export function jsonWithBigInts(value: unknown) {
  return JSON.stringify(value, (_, item) => (typeof item === "bigint" ? item.toString() : item));
}
