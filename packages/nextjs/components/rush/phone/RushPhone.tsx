"use client";

import { useEffect, useState } from "react";
import { hasDeparted, rushErrorText, sameAddress, useNow } from "../rush";
import { Confetti, LoginPanel, MiniBoard, MyTickets } from "./PhoneParts";
import { useRush } from "~~/hooks/rush/useRush";

const NAME_KEY = "rush-name";

type PushState =
  | { kind: "idle"; note?: string }
  | { kind: "pushing" }
  | { kind: "boarded"; trainId: bigint; seat: number; tokenId: bigint; teamwork: boolean }
  | { kind: "hanging"; trainId: bigint; until: number }
  | { kind: "error"; message: string };

export const RushPhone = () => {
  const { train, session, actions } = useRush();
  const now = useNow(500);
  const [name, setName] = useState("");
  const [state, setState] = useState<PushState>({ kind: "idle" });
  const [pressed, setPressed] = useState(false);

  useEffect(() => setName(localStorage.getItem(NAME_KEY) ?? ""), []);

  const me = session.status === "ready" ? session.address : undefined;
  const departed = !!train && hasDeparted(train, now);
  const myRider = train && !departed ? train.riders.find(r => sameAddress(r.address, me)) : undefined;

  // Follow the train: a door hanger either gets pulled in or falls off; a departed train frees the button.
  useEffect(() => {
    if (!train) return;
    if (state.kind === "hanging") {
      if (state.trainId !== train.trainId || departed) {
        setState({ kind: "idle", note: "Gir gaya! Train chali gayi. Agli mein dhakka do" });
      } else if (myRider) {
        setState({
          kind: "boarded",
          trainId: train.trainId,
          seat: myRider.seat,
          tokenId: myRider.tokenId,
          teamwork: true,
        });
      } else if (now > state.until + 1) {
        setState({ kind: "idle", note: "Gir gaya! Platform pe wapas. Phir se dhakka do" });
      }
    }
    if (state.kind === "boarded" && (state.trainId !== train.trainId || departed)) {
      setState({ kind: "idle", note: `Train #${state.trainId} chali gayi! Ticket neeche hai` });
    }
  }, [train, now, departed, myRider, state]);

  const ready = session.status === "ready";
  const onboard = !!myRider && state.kind !== "boarded";
  const blocked = !name.trim()
    ? "Pehle naam likho"
    : !ready
      ? "Pehle login karo"
      : !train
        ? "Train aa rahi hai…"
        : onboard || state.kind === "boarded"
          ? "Andar ho bhai. Agli train ka wait karo"
          : state.kind === "hanging"
            ? "Ab kisi aur ka dhakka chahiye!"
            : null;
  const busy = state.kind === "pushing" || state.kind === "hanging" || state.kind === "boarded";

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
    <div className="min-h-screen bg-[#2b211c] bg-[radial-gradient(ellipse_at_top,#4a382e,transparent_60%)] font-display text-white">
      <div className="mx-auto flex max-w-md flex-col gap-4 px-4 pb-10 pt-4">
        <MiniBoard train={train} now={now} />

        <div className="flex items-center gap-3">
          <div className="rounded-md border-4 border-[#1a0f0a] bg-[#ffd200] px-3 py-0.5 text-center font-extrabold leading-tight text-[#111]">
            <div className="text-sm">डेवकॉन</div>
            <div className="text-lg tracking-widest">DEVCON</div>
          </div>
          <div className="text-lg font-extrabold leading-tight">
            Mumbai Local Rush
            <div className="text-sm font-bold text-white/70">Platform 8 · naam likho, dhakka do!</div>
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold text-white/80">Tera naam (screen pe dikhega)</span>
          <input
            className="input input-lg w-full border-4 border-[#1a0f0a] bg-white font-display text-2xl font-extrabold text-[#1a0f0a]"
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
          <button
            disabled={!!blocked || busy}
            onPointerDown={() => setPressed(true)}
            onPointerUp={() => setPressed(false)}
            onPointerLeave={() => setPressed(false)}
            onClick={push}
            className={`relative flex h-64 w-64 flex-col items-center justify-center rounded-full border-[6px] border-[#1a0f0a] font-display font-extrabold transition-transform duration-75 select-none ${
              blocked || busy ? "bg-[#7a1f2b]/60 text-[#ffd200]/60" : "bg-[#7a1f2b] text-[#ffd200]"
            } ${pressed && !blocked && !busy ? "translate-y-[10px] shadow-[0_4px_0_#1a0f0a]" : "shadow-[0_14px_0_#1a0f0a]"}`}
          >
            <span className="absolute inset-3 rounded-full border-4 border-dashed border-[#ffd200]/50" />
            {state.kind === "pushing" ? (
              <>
                <span className="loading loading-dots loading-lg" />
                <span className="text-3xl">Aage chalo…</span>
              </>
            ) : (
              <>
                <span className="text-5xl leading-none">DHAKKA!</span>
                <span className="text-3xl leading-none">PUSH</span>
                {blocked && <span className="mt-2 px-6 text-center text-base text-white/90">{blocked}</span>}
              </>
            )}
          </button>
          {state.kind === "boarded" && <Confetti key={String(state.tokenId)} />}
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
      <div className="rounded-2xl border-4 border-[#1a0f0a] bg-[#fdf3d0] p-4 text-center text-[#1a0f0a]">
        <div className="text-2xl font-extrabold">Andar ho bhai.</div>
        <div className="font-bold">Agli train ka wait karo</div>
      </div>
    );
  }
  switch (state.kind) {
    case "boarded":
      return (
        <div className="rounded-2xl border-4 border-[#1a0f0a] bg-[#22c55e] p-4 text-center text-[#1a0f0a]">
          <div className="text-4xl font-extrabold">Chadh gaya!</div>
          <div className="text-xl font-extrabold">
            Seat {state.seat} · Ticket #{String(state.tokenId)}
          </div>
          {state.teamwork && <div className="font-bold">★ Teamwork push! Dost ne andar kheencha</div>}
          <div className="mt-1 text-sm font-bold">Screen pe dekho, tu train mein hai</div>
        </div>
      );
    case "hanging":
      return (
        <div className="rush-pulse rounded-2xl border-4 border-[#1a0f0a] bg-[#ef4444] p-4 text-center">
          <div className="text-2xl font-extrabold leading-tight">Tu door pe latak raha hai!</div>
          <div className="text-xl font-extrabold">
            Ek aur push chahiye: <span className="text-[#ffd200]">{Math.max(0, Math.ceil(state.until - now))}s</span>
          </div>
          <div className="mt-1 font-bold">Room ko chillao: &ldquo;DHAKKA DO!&rdquo;</div>
        </div>
      );
    case "error":
      return (
        <div className="rounded-2xl border-4 border-[#1a0f0a] bg-[#ffb4a8] p-4 text-center text-xl font-extrabold text-[#1a0f0a]">
          {state.message}
        </div>
      );
    case "idle":
      return state.note ? (
        <div className="rounded-2xl border-4 border-[#1a0f0a] bg-black/30 p-3 text-center text-lg font-extrabold">
          {state.note}
        </div>
      ) : null;
    default:
      return null;
  }
};
