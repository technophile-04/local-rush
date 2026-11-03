import { onchainTable } from "ponder";

export const train = onchainTable("train", (t) => ({
  id: t.bigint().primaryKey(),
  destination: t.text().notNull(),
  virarFast: t.boolean().notNull(),
  riders: t.integer().notNull(),
  teamworkRiders: t.integer().notNull(),
  firstBoardAt: t.bigint().notNull(),
  departedAt: t.bigint(),
}));

export const ride = onchainTable("ride", (t) => ({
  tokenId: t.bigint().primaryKey(),
  trainId: t.bigint().notNull(),
  rider: t.hex().notNull(),
  name: t.text().notNull(),
  seat: t.integer().notNull(),
  teamwork: t.boolean().notNull(),
  boardedAt: t.bigint().notNull(),
  owner: t.hex().notNull(),
}));
