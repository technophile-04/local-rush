import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { getMockHub } from "./mockWorld";
import type { LoginMethod, RushSource } from "~~/types/rush";

const LATENCY_MS = 1500; // fake tx confirmation time for the phone
const ADDRESS_KEY = "rush-mock-address";
const METHOD_KEY = "rush-mock-method";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const noopSubscribe = () => () => undefined;

const mockAddress = () => {
  let address = localStorage.getItem(ADDRESS_KEY);
  if (!address) {
    address =
      "0x" + Array.from(crypto.getRandomValues(new Uint8Array(20)), b => b.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(ADDRESS_KEY, address);
  }
  return address;
};

/** The crowd simulator behind the RushSource seam. Inert unless `enabled`. */
export const useMockRush = (enabled: boolean): RushSource => {
  const hub = enabled ? getMockHub() : null;
  const world = useSyncExternalStore(
    hub?.subscribe ?? noopSubscribe,
    () => hub?.world ?? null,
    () => null,
  );

  const [status, setStatus] = useState<"disconnected" | "connecting" | "ready">("disconnected");
  const [method, setMethod] = useState<LoginMethod | null>(null);
  const [address, setAddress] = useState<string>();

  useEffect(() => {
    if (!enabled) return;
    const saved = localStorage.getItem(METHOD_KEY) as LoginMethod | null;
    if (saved) {
      setMethod(saved);
      setAddress(mockAddress());
      setStatus("ready");
    }
  }, [enabled]);

  const login = useCallback(async (m: LoginMethod) => {
    setStatus("connecting");
    setMethod(m);
    await sleep(LATENCY_MS);
    setAddress(mockAddress());
    localStorage.setItem(METHOD_KEY, m);
    setStatus("ready");
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(METHOD_KEY);
    setStatus("disconnected");
    setMethod(null);
    setAddress(undefined);
  }, []);

  const push = useCallback(
    async (name: string) => {
      if (!hub || !address) throw new Error("NotLoggedIn");
      await sleep(LATENCY_MS);
      return hub.push(address, name);
    },
    [hub, address],
  );

  const sendTicket = useCallback(
    async (tokenId: bigint, to: string) => {
      if (!hub || !address) throw new Error("NotLoggedIn");
      if (!/^0x[0-9a-fA-F]{40}$/.test(to)) throw new Error("InvalidAddress");
      await sleep(LATENCY_MS);
      return hub.send(address, tokenId);
    },
    [hub, address],
  );

  const tickets = useMemo(() => (address && world?.tickets[address.toLowerCase()]) || [], [address, world?.tickets]);

  return useMemo(
    () => ({
      train: world?.train ?? null,
      stats: world?.stats ?? null,
      session: { status, method, address, login, logout },
      actions: { push, sendTicket, tickets },
    }),
    [world?.train, world?.stats, status, method, address, login, logout, push, sendTicket, tickets],
  );
};
