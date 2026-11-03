// The seam between the game UI and where its data comes from.
// UI components only consume these shapes. `hooks/rush/useRush.ts` picks the source:
// the mock simulator (`?mock=1`) or the chain (LocalRush contract on Base).

export type Rider = {
  address: string;
  name: string;
  seat: number; // 1-based boarding order
  teamwork: boolean; // boarded through a TEAMWORK PUSH
  tokenId: bigint; // ticket NFT minted on boarding
};

export type DoorHanger = {
  address: string;
  name: string;
  until: number; // unix seconds; a second push before this boards both
};

export type TrainView = {
  trainId: bigint;
  destination: string; // e.g. "VIRAR", "BORIVALI", "CHURCHGATE"
  virarFast: boolean; // rare 8:15 Virar Fast train
  capacity: number;
  teamworkFrom: number; // rider count from which one push is not enough
  firstBoardAt: number; // unix seconds, 0 while nobody has boarded
  departsAt: number; // unix seconds, 0 while nobody has boarded; also departs when full
  riders: Rider[]; // boarding order
  doorHanger: DoorHanger | null;
  // riderList: the departed train's final riders, so a train that filled between polls still departs with every name
  lastDeparted: { trainId: bigint; riders: number; riderList?: Rider[] } | null;
};

export type RushStats = {
  trainsDeparted: number;
  ridersTotal: number;
  teamworkPushes: number;
  recentTrains: { trainId: bigint; riders: number; destination: string; virarFast: boolean }[];
};

export type PushResult =
  | { kind: "boarded"; trainId: bigint; tokenId: bigint; seat: number; teamwork: boolean }
  | { kind: "hanging"; trainId: bigint; until: number };

export type LoginMethod = "passkey" | "wallet" | "burner";

export type Ticket = {
  tokenId: bigint;
  trainId: bigint;
  seat: number;
  held: boolean; // still in the rider's account; false once sent to their own wallet
  image?: string; // data: URI from tokenURI
};

export type RushSession = {
  status: "disconnected" | "connecting" | "ready";
  method: LoginMethod | null;
  address?: string; // the account that rides and holds tickets
  login(method: LoginMethod): Promise<void>;
  logout(): void;
};

export type RushActions = {
  push(name: string): Promise<PushResult>;
  sendTicket(tokenId: bigint, to: string): Promise<void>;
  tickets: Ticket[];
};

export type RushSource = {
  train: TrainView | null; // null while loading
  stats: RushStats | null; // null when the indexer is unreachable; the UI hides stats
  session: RushSession;
  actions: RushActions;
};
