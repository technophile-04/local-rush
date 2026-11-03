"use client";

import { useEffect, useState } from "react";
import { crowdLevel, hasDeparted, rushErrorText, sameAddress, useNow } from "../rush";
import { Confetti, LoginPanel, MiniBoard, MyTickets } from "./PhoneParts";
import { PhoneTrain } from "./PhoneTrain";
import { PushDoor, type PushEffort } from "./PushDoor";
import { useRush } from "~~/hooks/rush/useRush";

const NAME_KEY = "rush-name";

// Comfortable, Fourth seat, Feet off floor, Door pe latak raha: the fuller the train, the harder the shove.
const EFFORT: PushEffort[] = [
  { taps: 3, drainPerSec: 0.45 },
  { taps: 6, drainPerSec: 0.4 },
  { taps: 10, drainPerSec: 0.33 },
  { taps: 15, drainPerSec: 0.25 },
];

type PushState =
  | { kind: "idle"; note?: string }
  | { kind: "pushing" }
  | { kind: "boarded"; trainId: bigint; seat: number; tokenId: bigint; teamwork: boolean }
  | { kind: "hanging"; trainId: bigint; until: number }
  | { kind: "rode"; trainId: bigint; seat: number; tokenId: bigint } // pulled in, and the train already left
  | { kind: "error"; message: string };

export const RushPhone = () => {
  const { train, session, actions } = useRush();
  const now = useNow(500);
  const [name, setName] = useState("");
  const [state, setState] = useState<PushState>({ kind: "idle" });
  const [kick, setKick] = useState(0);

  useEffect(() => setName(localStorage.getItem(NAME_KEY) ?? ""), []);

  const me = session.status === "ready" ? session.address : undefined;
  const departed = !!train && hasDeparted(train, now);
  const myRider = train && !departed ? train.riders.find(r => sameAddress(r.address, me)) : undefined;
  const myHang =
    train && !departed && train.doorHanger && sameAddress(train.doorHanger.address, me) && now <= train.doorHanger.until
      ? train.doorHanger
      : undefined;

  // Follow the train: a door hanger either gets pulled in or falls off; a departed train frees the button.
  useEffect(() => {
    if (!train) return;
    if (myHang && (state.kind === "idle" || state.kind === "error")) {
      // After a reload (or a failed retry) the chain still has us at the door.
      setState({ kind: "hanging", trainId: train.trainId, until: myHang.until });
      return;
    }
    if (state.kind === "hanging") {
      // The push that pulls us in can also fill the train, so the feed may already show the next one.
      const riders =
        state.trainId === train.trainId
          ? train.riders
          : train.lastDeparted?.trainId === state.trainId
            ? train.lastDeparted.riderList
            : undefined;
      const mine =
        riders?.find(r => sameAddress(r.address, me)) ?? actions.tickets.find(t => t.trainId === state.trainId);
      if (mine && state.trainId === train.trainId && !departed) {
        setState({ kind: "boarded", trainId: train.trainId, seat: mine.seat, tokenId: mine.tokenId, teamwork: true });
      } else if (mine) {
        setState({ kind: "rode", trainId: state.trainId, seat: mine.seat, tokenId: mine.tokenId });
      } else if (state.trainId !== train.trainId || departed) {
        setState({ kind: "idle", note: "The train left without you. Push again for the next one" });
      } else if (now > state.until + 1) {
        setState({ kind: "idle", note: "You fell off the door. Push again" });
      }
    }
    if (state.kind === "boarded" && (state.trainId !== train.trainId || departed)) {
      setState({ kind: "idle", note: `Train #${state.trainId} departed. Your ticket is below` });
    }
  }, [train, now, departed, myHang, me, actions.tickets, state]);

  const ready = session.status === "ready";
  const onboard = !!myRider && state.kind !== "boarded";
  const blocked = !name.trim()
    ? "Enter your name first"
    : !ready
      ? "Log in first"
      : !train
        ? "Train arriving…"
        : onboard || state.kind === "boarded"
          ? "You're on this train"
          : state.kind === "hanging"
            ? "Waiting for one more push"
            : null;
  const busy = state.kind === "pushing" || state.kind === "hanging" || state.kind === "boarded";

  const effort = EFFORT[train ? crowdLevel(train.riders.length, train.capacity).index : 0] ?? EFFORT[0];

  const push = async () => {
    navigator.vibrate?.(80);
    setState({ kind: "pushing" });
    try {
      const r = await actions.push(name.trim());
      navigator.vibrate?.(r.kind === "boarded" ? [60, 40, 120] : [200]);
      setState(
        r.kind === "boarded"
          ? { kind: "boarded", trainId: r.trainId, seat: r.seat, tokenId: r.tokenId, teamwork: r.teamwork }
          : { kind: "hanging", trainId: r.trainId, until: r.until },
      );
    } catch (e) {
      setState({ kind: "error", message: rushErrorText(e) });
    }
  };

  return (
    <div className="rush-phone-page min-h-screen font-display text-white">
      <div className="mx-auto flex max-w-md flex-col gap-4 px-4 pb-10 pt-4">
        <MiniBoard train={train} now={now} />
        <PhoneTrain train={train} now={now} me={me} pushing={state.kind === "pushing"} kick={kick} />

        <div className="flex items-center gap-3">
          <div className="rounded-md border-4 border-[#1d1f23] bg-[#ffd200] px-3 py-0.5 text-center font-extrabold leading-tight text-[#111]">
            <div className="text-sm">डेवकॉन</div>
            <div className="text-lg tracking-widest">DEVCON</div>
          </div>
          <div className="text-lg font-extrabold leading-tight">
            Mumbai Local Rush
            <div className="text-sm font-bold text-white/70">Platform 8 · type your name, then push</div>
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold text-white/80">Your name (shown on the big screen)</span>
          <input
            className="input input-lg w-full border-4 border-[#1d1f23] bg-white font-display text-2xl font-extrabold text-[#1d1f23]"
            value={name}
            maxLength={20}
            placeholder="e.g. Bunty"
            onChange={e => {
              setName(e.target.value);
              localStorage.setItem(NAME_KEY, e.target.value);
            }}
          />
        </label>

        <LoginPanel session={session} />

        <div className="relative flex flex-col items-center gap-3 py-2">
          <PushDoor
            look={
              state.kind === "pushing"
                ? "pushing"
                : !name.trim() || !ready || !train
                  ? "closed"
                  : onboard || busy
                    ? "crowded"
                    : "open"
            }
            effort={effort}
            sign={state.kind === "pushing" ? "Pushing…" : (blocked ?? "Tap fast or hold the door to push in")}
            onTap={() => setKick(k => k + 1)}
            onPush={push}
          />
          {(state.kind === "boarded" || state.kind === "rode") && <Confetti key={String(state.tokenId)} />}
        </div>

        <StatusCard state={state} now={now} onboard={onboard} />

        <MyTickets actions={actions} />
      </div>
    </div>
  );
};

const StatusCard = ({ state, now, onboard }: { state: PushState; now: number; onboard: boolean }) => {
  if (onboard) {
    return (
      <div className="rounded-2xl border-4 border-[#1d1f23] bg-[#f3f1ee] p-4 text-center text-[#1d1f23]">
        <div className="text-2xl font-extrabold">You&apos;re on this train.</div>
        <div className="font-bold">Wait for the next one</div>
      </div>
    );
  }
  switch (state.kind) {
    case "boarded":
      return (
        <div className="rounded-2xl border-4 border-[#1d1f23] bg-[#22c55e] p-4 text-center text-[#1d1f23]">
          <div className="text-4xl font-extrabold">Boarded!</div>
          <div className="text-xl font-extrabold">
            Seat {state.seat} · Ticket #{String(state.tokenId)}
          </div>
          {state.teamwork && <div className="font-bold">★ Teamwork push: someone pulled you in</div>}
          <div className="mt-1 text-sm font-bold">Look for your name on the big screen</div>
        </div>
      );
    case "rode":
      return (
        <div className="rounded-2xl border-4 border-[#1d1f23] bg-[#22c55e] p-4 text-center text-[#1d1f23]">
          <div className="text-4xl font-extrabold">Boarded!</div>
          <div className="text-xl font-extrabold">
            Seat {state.seat} · Ticket #{String(state.tokenId)}
          </div>
          <div className="font-bold">★ Teamwork push: someone pulled you in</div>
          <div className="mt-1 text-sm font-bold">
            Train #{String(state.trainId)} has left. Push again for the next one
          </div>
        </div>
      );
    case "hanging":
      return (
        <div className="rush-pulse rounded-2xl border-4 border-[#1d1f23] bg-[#ef4444] p-4 text-center">
          <div className="text-2xl font-extrabold leading-tight">You&apos;re hanging at the door.</div>
          <div className="text-xl font-extrabold">
            One more push in <span className="text-[#ffd200]">{Math.max(0, Math.ceil(state.until - now))}s</span> gets
            you both in
          </div>
          <div className="mt-1 font-bold">Ask the room to push!</div>
        </div>
      );
    case "error":
      return (
        <div className="rounded-2xl border-4 border-[#1d1f23] bg-[#ffb4a8] p-4 text-center text-xl font-extrabold text-[#1d1f23]">
          {state.message}
        </div>
      );
    case "idle":
      return state.note ? (
        <div className="rounded-2xl border-4 border-[#1d1f23] bg-black/30 p-3 text-center text-lg font-extrabold">
          {state.note}
        </div>
      ) : null;
    default:
      return null;
  }
};
