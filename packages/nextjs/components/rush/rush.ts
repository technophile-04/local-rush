import { useEffect, useState } from "react";
import { encodePacked, keccak256 } from "viem";
import type { TrainView } from "~~/types/rush";
import { getParsedError } from "~~/utils/scaffold-eth";

/** Wall clock in unix seconds (float), re-rendering every `ms`. */
export const useNow = (ms = 250) => {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() / 1000), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
};

/** A train has left once its timer passed or it filled up. The chain only rolls over on the next push. */
export const hasDeparted = (train: TrainView, now: number) =>
  train.departsAt > 0 && (now >= train.departsAt || train.riders.length >= train.capacity);

export const CROWD_STOPS = [
  { upTo: 0.4, label: "Comfortable", phone: "Comfortable", color: "#22c55e" },
  { upTo: 0.7, label: "Fourth seat", phone: "Fourth seat", color: "#facc15" },
  { upTo: 0.9, label: "Feet off floor", phone: "Feet off floor", color: "#f97316" },
  { upTo: Infinity, label: "Door pe latak raha", phone: "Hanging at the door", color: "#ef4444" },
] as const;

export const crowdLevel = (riders: number, capacity: number) => {
  const fill = capacity > 0 ? riders / capacity : 0;
  const index = CROWD_STOPS.findIndex(s => fill < s.upTo);
  return { fill, index, ...CROWD_STOPS[index] };
};

/**
 * Riders who fly off the roof at Mahim: uint256(keccak256(abi.encodePacked(uint256 trainId, uint256 seat))) % 8 == 0.
 * The ticket NFT trait must use the same formula.
 */
export const fliesAtMahim = (trainId: bigint, seat: number) =>
  BigInt(keccak256(encodePacked(["uint256", "uint256"], [trainId, BigInt(seat)]))) % 8n === 0n;

/** Mumbai indicator time format: 12-hour, no leading zero, dot separator ("9.04"). */
export const indicatorTime = (unixSeconds: number) => {
  const d = new Date(unixSeconds * 1000);
  const h = d.getHours() % 12 || 12;
  return `${h}.${String(d.getMinutes()).padStart(2, "0")}`;
};

export const countdown = (seconds: number) => {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export const dueLabel = (seconds: number) => {
  if (seconds <= 0) return "GONE";
  if (seconds < 60) return `${Math.ceil(seconds)} s`;
  return `${Math.ceil(seconds / 60)} min`;
};

/** Turns a push/send/login failure into a short plain-English line for the phone. */
export const rushErrorText = (error: unknown, fallback = "Couldn't push, try again") => {
  const message = getParsedError(error);
  if (/AlreadyOnTrain/i.test(message)) return "You're on this train. Wait for the next one";
  if (/AlreadyHanging|StillHanging/i.test(message)) return "You're already at the door. Someone else needs to push";
  if (/NotLoggedIn/i.test(message)) return "Log in first";
  if (/InvalidAddress/i.test(message)) return "That address doesn't look right";
  if (/NameRequired/i.test(message)) return "Enter your name first";
  if (/reject|denied|cancel/i.test(message)) return "Cancelled. Try again";
  // The chain source already throws short, human messages; show those, hide raw RPC dumps.
  const technical = /0x[0-9a-f]{8}|execution reverted|Request Arguments|Details:|Version:/i;
  return message && message.length <= 140 && !technical.test(message) ? message : fallback;
};

export const sameAddress = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
