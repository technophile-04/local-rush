import { type Address, createPublicClient, http, zeroAddress } from "viem";
import { base } from "viem/chains";
import { rushContract } from "~~/services/rush/contract";
import type { Ticket, TrainView } from "~~/types/rush";

export const baseReadClient = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL || "https://mainnet.base.org"),
});

async function readTrain(): Promise<TrainView> {
  // Read both calls at one block so a departure cannot mix two trains' state.
  const blockNumber = await baseReadClient.getBlockNumber({ cacheTime: 0 });
  const state = await baseReadClient.readContract({ ...rushContract, functionName: "status", blockNumber });
  const riders = await baseReadClient.readContract({
    ...rushContract,
    functionName: "getRiders",
    args: [state.trainId],
    blockNumber,
  });
  return {
    trainId: state.trainId,
    destination: state.destination,
    virarFast: state.virarFast,
    capacity: state.capacity,
    teamworkFrom: Number(state.teamworkFrom),
    firstBoardAt: Number(state.firstBoardAt),
    departsAt: Number(state.departsAt),
    riders: riders.map(({ rider, ...rest }) => ({ address: rider, ...rest })),
    doorHanger:
      state.doorHanger === zeroAddress
        ? null
        : { address: state.doorHanger, name: state.doorHangerName, until: Number(state.doorHangUntil) },
    lastDeparted:
      state.lastDepartedTrainId === 0n
        ? null
        : { trainId: state.lastDepartedTrainId, riders: Number(state.lastDepartedRiders) },
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
