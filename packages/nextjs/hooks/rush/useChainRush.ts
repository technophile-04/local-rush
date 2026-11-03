import type { RushSource } from "~~/types/rush";

const notWired = () => Promise.reject(new Error("Chain source not wired yet"));

// Placeholder for the LocalRush chain source. Replaced by the chain integration.
const CHAIN_STUB: RushSource = {
  train: null,
  stats: null,
  session: { status: "disconnected", method: null, login: notWired, logout: () => undefined },
  actions: { push: notWired, sendTicket: notWired, tickets: [] },
};

export const useChainRush = (): RushSource => CHAIN_STUB;
