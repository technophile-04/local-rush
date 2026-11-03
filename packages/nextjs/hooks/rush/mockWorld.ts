import { hasDeparted } from "~~/components/rush/rush";
import type { PushResult, Rider, RushStats, Ticket, TrainView } from "~~/types/rush";

// A simulated LocalRush contract plus a bot crowd. Same rules as the contract, faster clock:
// capacity 30, departs when full or MOCK_DEPART_AFTER s after the first rider, teamwork needed
// from 80% (50% on a Virar Fast), a door hanger boards with the next pusher within 15 s.
//
// Tabs of one browser share a single world over BroadcastChannel("rush-mock"): the oldest tab
// is the leader (runs bots, applies pushes, broadcasts state); other tabs forward requests to it.

export const CAPACITY = 30;
export const MOCK_DEPART_AFTER = 45;
export const HANG_SECONDS = 15;
const FIRST_TRAIN_ID = 41n; // train #42 is the first 8:15 Virar Fast, so rehearsals see chaos mode early
const FIRST_TOKEN_ID = 400n;
const DESTINATIONS = [
  "CHURCHGATE",
  "VIRAR",
  "BORIVALI",
  "ANDHERI",
  "BANDRA",
  "DADAR",
  "MALAD",
  "BHAYANDAR",
  "GOREGAON",
];
const BOT_NAMES = [
  "Rahul",
  "Priya",
  "Sneha",
  "Aarav",
  "Kaka",
  "Pinky",
  "Bunty",
  "Anjali",
  "Faisal",
  "Siddhesh",
  "Tanvi",
  "Omkar",
  "Rohan",
  "Zoya",
  "Pappu",
  "Meera",
  "Imran",
  "Kavya",
  "Chintu",
  "Neha",
  "Vikram",
  "Sakshi",
  "Aditya",
  "Ayesha",
  "Mangesh",
  "Shruti",
  "Tejas",
  "Farhan",
  "Gauri",
  "Sunil Mama",
  "Dolly",
  "Raju",
  "Pooja",
  "Nikhil",
  "Simran",
  "Yash",
  "Rekha Tai",
  "Sameer",
  "Ishaan",
  "Bablu",
];
const BOT_PREFIX = "0xb07";

export type MockWorld = {
  version: number;
  train: TrainView;
  stats: RushStats;
  nextTokenId: bigint;
  tickets: Record<string, Ticket[]>; // lowercased address → tickets (humans only)
};

const nowSec = () => Math.floor(Date.now() / 1000);

const isVirarFast = (trainId: bigint) => trainId % 6n === 0n;

const newTrain = (trainId: bigint, lastDeparted: TrainView["lastDeparted"]): TrainView => {
  const virarFast = isVirarFast(trainId);
  return {
    trainId,
    destination: virarFast ? "VIRAR" : DESTINATIONS[Number(trainId % BigInt(DESTINATIONS.length))],
    virarFast,
    capacity: CAPACITY,
    teamworkFrom: Math.floor(CAPACITY * (virarFast ? 0.5 : 0.8)),
    firstBoardAt: 0,
    departsAt: 0,
    riders: [],
    doorHanger: null,
    lastDeparted,
  };
};

export const createWorld = (): MockWorld => ({
  version: 0,
  train: newTrain(FIRST_TRAIN_ID, null),
  stats: { trainsDeparted: 0, ridersTotal: 0, teamworkPushes: 0, recentTrains: [] },
  nextTokenId: FIRST_TOKEN_ID,
  tickets: {},
});

const rollover = (w: MockWorld) => {
  const old = w.train;
  w.stats.trainsDeparted += 1;
  w.stats.recentTrains = [
    { trainId: old.trainId, riders: old.riders.length, destination: old.destination, virarFast: old.virarFast },
    ...w.stats.recentTrains,
  ].slice(0, 5);
  w.train = newTrain(old.trainId + 1n, { trainId: old.trainId, riders: old.riders.length });
};

const board = (w: MockWorld, address: string, name: string, teamwork: boolean, now: number): Rider => {
  const t = w.train;
  const rider: Rider = { address, name, seat: t.riders.length + 1, teamwork, tokenId: w.nextTokenId };
  w.nextTokenId += 1n;
  t.riders.push(rider);
  w.stats.ridersTotal += 1;
  if (t.firstBoardAt === 0) {
    t.firstBoardAt = now;
    t.departsAt = now + MOCK_DEPART_AFTER;
  }
  if (t.riders.length >= t.capacity) t.departsAt = Math.min(t.departsAt, now);
  if (!address.startsWith(BOT_PREFIX)) {
    const key = address.toLowerCase();
    w.tickets[key] = [
      { tokenId: rider.tokenId, trainId: t.trainId, seat: rider.seat, held: true },
      ...(w.tickets[key] ?? []),
    ];
  }
  return rider;
};

/** Applies one push to a copy of the world, like the contract's push(name). Throws on revert. */
export const applyPush = (prev: MockWorld, address: string, rawName: string, now = nowSec()) => {
  const name = rawName.trim().slice(0, 20);
  if (!name) throw new Error("NameRequired");
  const w = structuredClone(prev);
  if (hasDeparted(w.train, now)) rollover(w);
  const t = w.train;
  const addr = address.toLowerCase();
  if (t.riders.some(r => r.address.toLowerCase() === addr)) throw new Error("AlreadyOnTrain");
  if (t.doorHanger && t.doorHanger.until < now) t.doorHanger = null; // fell off
  let result: PushResult;
  if (t.doorHanger) {
    if (t.doorHanger.address.toLowerCase() === addr) throw new Error("AlreadyHanging");
    board(w, t.doorHanger.address, t.doorHanger.name, true, now);
    const rider = board(w, address, name, true, now);
    t.doorHanger = null;
    w.stats.teamworkPushes += 1;
    result = { kind: "boarded", trainId: t.trainId, tokenId: rider.tokenId, seat: rider.seat, teamwork: true };
  } else if (t.riders.length >= t.teamworkFrom) {
    t.doorHanger = { address, name, until: now + HANG_SECONDS };
    result = { kind: "hanging", trainId: t.trainId, until: t.doorHanger.until };
  } else {
    const rider = board(w, address, name, false, now);
    result = { kind: "boarded", trainId: t.trainId, tokenId: rider.tokenId, seat: rider.seat, teamwork: false };
  }
  w.version += 1;
  return { world: w, result };
};

export const applySend = (prev: MockWorld, address: string, tokenId: bigint) => {
  const w = structuredClone(prev);
  const ticket = w.tickets[address.toLowerCase()]?.find(t => t.tokenId === tokenId);
  if (!ticket) throw new Error("NotYourTicket");
  ticket.held = false;
  w.version += 1;
  return w;
};

// ---- bots ----

const rand = (min: number, max: number) => min + Math.random() * (max - min);

const botAddress = () =>
  BOT_PREFIX + Array.from({ length: 37 }, () => Math.floor(Math.random() * 16).toString(16)).join("");

const pickBotName = (train: TrainView) => {
  const taken = new Set([...train.riders.map(r => r.name), train.doorHanger?.name]);
  const free = BOT_NAMES.filter(n => !taken.has(n));
  const pool = free.length ? free : BOT_NAMES.map(n => `${n} ${Math.floor(rand(2, 9))}`);
  return pool[Math.floor(Math.random() * pool.length)];
};

/** When the next bot should push, in unix seconds (float). Speeds up as the train fills. */
const nextBotAt = (w: MockWorld, now: number) => {
  const t = w.train;
  if (hasDeparted(t, now)) return t.departsAt + rand(7, 10); // let the departure play out
  if (t.doorHanger && t.doorHanger.until >= now) return now + rand(2, 18); // sometimes they fall off
  const fill = t.riders.length / t.capacity;
  const base = 2.2 - 1.6 * fill;
  return now + base * rand(0.5, 1.5) * (t.virarFast ? 0.6 : 1);
};

// ---- multi-tab hub ----

type Msg =
  | { t: "hello"; from: string }
  | { t: "state"; from: string; born: number; world: MockWorld }
  | { t: "push"; from: string; req: string; address: string; name: string }
  | { t: "send"; from: string; req: string; address: string; tokenId: bigint }
  | { t: "reply"; to: string; req: string; ok: boolean; result?: PushResult; error?: string };

const ELECTION_MS = 600;
const LEADER_TIMEOUT_MS = 2500;
const HEARTBEAT_MS = 1000;
const TICK_MS = 250;

export class MockHub {
  world: MockWorld | null = null;
  private readonly id = Math.random().toString(36).slice(2);
  private readonly born = Date.now();
  private leader = false;
  private lastLeaderSeen = 0;
  private botAt = 0;
  private channel: BroadcastChannel | null = null;
  private listeners = new Set<() => void>();
  private pending = new Map<string, { resolve: (r?: PushResult) => void; reject: (e: Error) => void }>();

  constructor() {
    if (typeof BroadcastChannel !== "undefined") {
      this.channel = new BroadcastChannel("rush-mock");
      this.channel.onmessage = e => this.onMessage(e.data as Msg);
      this.post({ t: "hello", from: this.id });
      setTimeout(() => {
        if (!this.world) this.becomeLeader(createWorld());
      }, ELECTION_MS);
    } else {
      this.becomeLeader(createWorld());
    }
    setInterval(() => this.tick(), TICK_MS);
    setInterval(() => {
      if (this.leader) this.broadcast();
      else if (this.world && Date.now() - this.lastLeaderSeen > LEADER_TIMEOUT_MS) this.becomeLeader(this.world);
    }, HEARTBEAT_MS);
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  getWorld = () => this.world;

  push(address: string, name: string): Promise<PushResult> {
    if (this.leader && this.world) return Promise.resolve(this.localPush(address, name));
    return this.request({ t: "push", from: this.id, req: this.newReq(), address, name }) as Promise<PushResult>;
  }

  send(address: string, tokenId: bigint): Promise<void> {
    if (this.leader && this.world) {
      this.setWorld(applySend(this.world, address, tokenId));
      return Promise.resolve();
    }
    return this.request({ t: "send", from: this.id, req: this.newReq(), address, tokenId }).then(() => undefined);
  }

  private newReq = () => Math.random().toString(36).slice(2);

  private request(msg: Extract<Msg, { req: string; from: string }>) {
    return new Promise<PushResult | undefined>((resolve, reject) => {
      this.pending.set(msg.req, { resolve, reject });
      this.post(msg);
      setTimeout(() => {
        if (this.pending.delete(msg.req)) reject(new Error("Timeout"));
      }, 4000);
    });
  }

  private localPush(address: string, name: string) {
    const { world, result } = applyPush(this.world!, address, name);
    this.setWorld(world);
    return result;
  }

  private becomeLeader(world: MockWorld) {
    this.leader = true;
    this.botAt = Date.now() / 1000 + rand(1, 3);
    this.setWorld(world);
  }

  private setWorld(world: MockWorld) {
    this.world = world;
    if (this.leader) this.broadcast();
    this.listeners.forEach(fn => fn());
  }

  private broadcast() {
    if (this.world) this.post({ t: "state", from: this.id, born: this.born, world: this.world });
  }

  private post(msg: Msg) {
    this.channel?.postMessage(msg);
  }

  private outranks(from: string, born: number) {
    return born < this.born || (born === this.born && from < this.id);
  }

  private onMessage(msg: Msg) {
    switch (msg.t) {
      case "hello":
        if (this.leader) this.broadcast();
        break;
      case "state":
        if (this.leader && !this.outranks(msg.from, msg.born)) return; // a younger tab; it will step down
        this.leader = false;
        this.lastLeaderSeen = Date.now();
        if (!this.world || this.world.version !== msg.world.version) this.setWorld(msg.world);
        break;
      case "push":
      case "send": {
        if (!this.leader || !this.world) return;
        try {
          if (msg.t === "push") {
            const result = this.localPush(msg.address, msg.name);
            this.post({ t: "reply", to: msg.from, req: msg.req, ok: true, result });
          } else {
            this.setWorld(applySend(this.world, msg.address, msg.tokenId));
            this.post({ t: "reply", to: msg.from, req: msg.req, ok: true });
          }
        } catch (e) {
          this.post({ t: "reply", to: msg.from, req: msg.req, ok: false, error: (e as Error).message });
        }
        break;
      }
      case "reply": {
        if (msg.to !== this.id) return;
        const p = this.pending.get(msg.req);
        if (!p) return;
        this.pending.delete(msg.req);
        if (msg.ok) p.resolve(msg.result);
        else p.reject(new Error(msg.error));
        break;
      }
    }
  }

  private tick() {
    if (!this.leader || !this.world) return;
    const now = Date.now() / 1000;
    const t = this.world.train;
    if (hasDeparted(t, now) && this.botAt < t.departsAt + 7) this.botAt = nextBotAt(this.world, now);
    if (now < this.botAt) return;
    try {
      this.localPush(botAddress(), pickBotName(this.world.train));
    } catch {
      // a bot never retries; the next one comes along
    }
    this.botAt = nextBotAt(this.world, now);
  }
}

let hub: MockHub | null = null;
export const getMockHub = () => (hub ??= new MockHub());
