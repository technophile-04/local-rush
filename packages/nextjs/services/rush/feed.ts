import type { Rider, RushStats, Ticket, TrainView } from "~~/types/rush";

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Invalid feed response.");
  return value as Record<string, unknown>;
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("Invalid feed list.");
  return value;
}

function text(value: unknown) {
  if (typeof value !== "string") throw new Error("Invalid feed text.");
  return value;
}

function number(value: unknown) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("Invalid feed number.");
  return value;
}

function boolean(value: unknown) {
  if (typeof value !== "boolean") throw new Error("Invalid feed flag.");
  return value;
}

function id(value: unknown) {
  const decimal = text(value);
  if (!/^\d+$/.test(decimal)) throw new Error("Invalid feed ID.");
  return BigInt(decimal);
}

function rider(value: unknown): Rider {
  const rider = object(value);
  return {
    address: text(rider.address),
    name: text(rider.name),
    seat: number(rider.seat),
    teamwork: boolean(rider.teamwork),
    tokenId: id(rider.tokenId),
  };
}

export function parseTrainView(value: unknown): TrainView {
  const train = object(value);
  const hanger = train.doorHanger === null ? null : object(train.doorHanger);
  const departed = train.lastDeparted === null ? null : object(train.lastDeparted);
  return {
    trainId: id(train.trainId),
    destination: text(train.destination),
    virarFast: boolean(train.virarFast),
    capacity: number(train.capacity),
    teamworkFrom: number(train.teamworkFrom),
    firstBoardAt: number(train.firstBoardAt),
    departsAt: number(train.departsAt),
    riders: array(train.riders).map(rider),
    doorHanger: hanger ? { address: text(hanger.address), name: text(hanger.name), until: number(hanger.until) } : null,
    lastDeparted: departed
      ? {
          trainId: id(departed.trainId),
          riders: number(departed.riders),
          riderList: departed.riderList === undefined ? undefined : array(departed.riderList).map(rider),
        }
      : null,
  };
}

export function parseTickets(value: unknown): Ticket[] {
  return array(value).map(value => {
    const ticket = object(value);
    return {
      tokenId: id(ticket.tokenId),
      trainId: id(ticket.trainId),
      seat: number(ticket.seat),
      held: boolean(ticket.held),
      image: ticket.image === undefined ? undefined : text(ticket.image),
    };
  });
}

export function parseStats(value: unknown): RushStats {
  const stats = object(value);
  return {
    trainsDeparted: number(stats.trainsDeparted),
    ridersTotal: number(stats.ridersTotal),
    teamworkPushes: number(stats.teamworkPushes),
    recentTrains: array(stats.recentTrains).map(value => {
      const train = object(value);
      return {
        trainId: id(train.trainId),
        riders: number(train.riders),
        destination: text(train.destination),
        virarFast: boolean(train.virarFast),
      };
    }),
  };
}

export async function fetchFeed(url: string): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error("The feed is unavailable. Try again shortly.");
  return response.json();
}

export async function fetchStats(url: string): Promise<RushStats | null> {
  try {
    return parseStats(await fetchFeed(`${url.replace(/\/$/, "")}/stats`));
  } catch {
    return null;
  }
}
