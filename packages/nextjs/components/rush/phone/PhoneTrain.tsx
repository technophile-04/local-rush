"use client";

import { useEffect, useRef, useState } from "react";
import { hasDeparted, sameAddress } from "../rush";
import { CoachBody, DOORS, DOOR_W, Figure, SLOTS, pct } from "../screen/Coach";
import type { DoorHanger, TrainView } from "~~/types/rush";

// Same timing as the projector (RushScreen) so the phone and the big screen leave together.
const LEAVE_MS = 5500;
const ARRIVE_MS = 3000;
const CAPTION_MS = 2200;
const HANGER_SLOT = { x: DOORS[2] + DOOR_W + 26, y: 176 };

type Stage = { kind: "live" } | { kind: "leaving"; snapshot: TrainView } | { kind: "arriving" };
type Caption = { id: number; text: string; tone: "board" | "fall" | "horn" };

/** Mirrors RushScreen's useDeparture: animate a train out when it departs or the feed already moved on. */
const useDeparture = (train: TrainView | null, now: number, onLeave: (t: TrainView) => void) => {
  const [stage, setStage] = useState<Stage>({ kind: "live" });
  const [left, setLeft] = useState<ReadonlySet<bigint>>(new Set());
  const lastLive = useRef<TrainView | null>(null);
  const leaveCb = useRef(onLeave);
  useEffect(() => {
    leaveCb.current = onLeave;
  }, [onLeave]);

  useEffect(() => {
    if (!train || stage.kind !== "live") return;
    const prev = lastLive.current;
    let leaving: TrainView | null = null;
    const departing = prev && prev.trainId !== train.trainId && !left.has(prev.trainId) ? prev : null;
    const finalRiders = departing && train.lastDeparted?.trainId === departing.trainId && train.lastDeparted.riderList;
    if (departing && finalRiders) leaving = { ...departing, riders: finalRiders };
    else if (departing && departing.riders.length > 0) leaving = departing;
    else if (hasDeparted(train, now) && !left.has(train.trainId)) leaving = train;
    if (!left.has(train.trainId)) lastLive.current = train;
    if (leaving) {
      const gone = leaving;
      setLeft(s => new Set(s).add(gone.trainId));
      setStage({ kind: "leaving", snapshot: gone });
      leaveCb.current(gone);
    }
  }, [train, now, stage.kind, left]);

  useEffect(() => {
    if (stage.kind === "live") return;
    const t = setTimeout(
      () => setStage(stage.kind === "leaving" ? { kind: "arriving" } : { kind: "live" }),
      stage.kind === "leaving" ? LEAVE_MS : ARRIVE_MS,
    );
    return () => clearTimeout(t);
  }, [stage]);

  return { stage, waiting: !train || left.has(train.trainId) };
};

/** The countdown ring a door hanger has until a second push pulls them in. */
const HangRing = ({ left, total }: { left: number; total: number }) => {
  const r = 16;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, left / total));
  return (
    <div
      className="absolute z-[70] flex h-[11cqh] w-[11cqh] items-center justify-center"
      style={{ ...pct(HANGER_SLOT.x - 4, HANGER_SLOT.y - 112), transform: "translate(-50%, -50%)" }}
    >
      <svg viewBox="0 0 40 40" className="absolute inset-0 h-full w-full -rotate-90">
        <circle cx="20" cy="20" r={r} fill="#1a0f0a" stroke="#3a2a22" strokeWidth="5" />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke={frac > 0.34 ? "#ffd200" : "#ef4444"}
          strokeWidth="5"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-500 ease-linear"
        />
      </svg>
      <span className="relative font-display text-[5cqh] font-extrabold text-white">{Math.ceil(left)}</span>
    </div>
  );
};

type PhoneTrainProps = {
  train: TrainView | null;
  now: number;
  me?: string;
  pushing: boolean;
  kick?: number; // bumps on every shove at the door, so the coach squeezes along
};

export const PhoneTrain = ({ train, now, me, pushing, kick = 0 }: PhoneTrainProps) => {
  const [caption, setCaption] = useState<Caption | null>(null);
  const [rodeOff, setRodeOff] = useState<bigint | null>(null); // a train that left with us on it
  const meRef = useRef(me);
  useEffect(() => {
    meRef.current = me;
  }, [me]);

  const { stage, waiting } = useDeparture(train, now, gone => {
    setCaption({ id: Date.now(), text: "PAAAM!", tone: "horn" });
    if (gone.riders.some(r => sameAddress(r.address, meRef.current))) {
      setRodeOff(gone.trainId);
      navigator.vibrate?.([120, 60, 120]);
    }
  });
  const leaving = stage.kind === "leaving" ? stage.snapshot : null;
  const shown = leaving ?? (waiting ? null : train);

  // New riders pop in; our own boarding gets the "Chadh gaya!" burst.
  const [latestSeats, setLatestSeats] = useState<Set<number>>(new Set());
  const seen = useRef<{ trainId: bigint; count: number } | null>(null);
  useEffect(() => {
    if (!train) return;
    const prev = seen.current;
    const from = prev && prev.trainId === train.trainId ? prev.count : 0;
    seen.current = { trainId: train.trainId, count: train.riders.length };
    if (!prev || train.riders.length <= from) return;
    const fresh = train.riders.slice(from);
    setLatestSeats(new Set(fresh.map(r => r.seat)));
    const mine = fresh.find(r => sameAddress(r.address, meRef.current));
    if (mine) {
      setCaption({ id: Date.now(), text: mine.teamwork ? "Chadh gaya! Both in!" : "Chadh gaya!", tone: "board" });
      setRodeOff(null);
    }
  }, [train]);

  // Door hanger: clings on until `until`; slides off if nobody pushed in time.
  const hangerLive = train?.doorHanger && now <= train.doorHanger.until && !waiting && !hasDeparted(train, now);
  const activeHanger = hangerLive ? train!.doorHanger : null;
  const [falling, setFalling] = useState<DoorHanger | null>(null);
  const lastHanger = useRef<DoorHanger | null>(null);
  // The ring's full length is however long the hang had left when we first saw it.
  const [hangTotal, setHangTotal] = useState<{ until: number; total: number } | null>(null);
  useEffect(() => {
    if (!activeHanger) return;
    const { until } = activeHanger;
    setHangTotal(t => (t?.until === until ? t : { until, total: Math.max(5, until - Date.now() / 1000) }));
  }, [activeHanger]);
  useEffect(() => {
    const prev = lastHanger.current;
    if (activeHanger) {
      lastHanger.current = activeHanger;
      return;
    }
    if (!prev) return;
    lastHanger.current = null;
    const boarded = train?.riders.some(r => sameAddress(r.address, prev.address));
    if (boarded) return;
    setFalling(prev);
    if (sameAddress(prev.address, meRef.current)) {
      setCaption({ id: Date.now(), text: "You slipped off!", tone: "fall" });
      navigator.vibrate?.(250);
    }
    setTimeout(() => setFalling(null), 1600);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeHanger?.address, activeHanger?.until]);

  useEffect(() => {
    if (rodeOff === null) return;
    const t = setTimeout(() => setRodeOff(null), 15000);
    return () => clearTimeout(t);
  }, [rodeOff]);

  useEffect(() => {
    if (!caption) return;
    const t = setTimeout(() => setCaption(null), caption.tone === "horn" ? 3000 : CAPTION_MS);
    return () => clearTimeout(t);
  }, [caption]);

  // Every shove at the door squeezes the coach too (WAAPI, so riders don't remount and replay their pop).
  const kickRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!kick || !kickRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    kickRef.current.animate(
      [
        { transform: "translateY(0) scale(1, 1)" },
        { transform: "translateY(1.5%) scale(0.99, 1.015)", offset: 0.35 },
        { transform: "translateY(0) scale(1, 1)" },
      ],
      { duration: 240, easing: "ease-out" },
    );
  }, [kick]);

  const riders = shown?.riders ?? [];
  const capacity = shown?.capacity ?? 30;
  const fill = capacity > 0 ? riders.length / capacity : 0;
  const scale = 1.08 - 0.28 * Math.min(fill, 1);
  const closing =
    stage.kind === "live" && !!shown && shown.departsAt > 0 && shown.departsAt - now <= 10 && shown.departsAt - now > 0;
  const hanger = leaving
    ? null
    : activeHanger
      ? { ...activeHanger, falling: false }
      : falling && { ...falling, falling: true };
  const hangerIsMe = !!hanger && sameAddress(hanger.address, me);

  const coachMotion =
    stage.kind === "leaving"
      ? "rush-leave"
      : stage.kind === "arriving"
        ? "rush-arrive"
        : pushing
          ? "rush-phone-squeeze"
          : closing
            ? "rush-shake"
            : "";

  return (
    <div className="rush-phone-train relative left-1/2 w-[min(100vw,640px)] -translate-x-1/2">
      {/* Clip the 16:10 stage to its top 82%: 1cqh then sizes figures like the projector does. */}
      <div
        className="relative w-full overflow-hidden rounded-none sm:rounded-2xl"
        style={{ aspectRatio: "1.6 / 0.82" }}
      >
        <div className="rush-stage absolute inset-x-0 top-0 w-full select-none" style={{ aspectRatio: "1.6" }}>
          {/* backdrop: platform roof haze, track, yellow platform edge */}
          <div className="absolute inset-x-0 top-0 h-[68cqh] bg-gradient-to-b from-[#3d3029] via-[#e8b07a] to-[#c98e5d]" />
          <div className="absolute inset-x-0 top-[63cqh] h-[6cqh] bg-[#3a3330]" />
          <div className="absolute inset-x-0 top-[68.5cqh] h-[3.5cqh] border-y-[0.4cqh] border-[#1a0f0a] bg-[#ffd200] bg-[radial-gradient(circle,#c79f00_25%,transparent_27%)] bg-[length:2.4cqh_2.4cqh]" />
          <div className="absolute inset-x-0 top-[72cqh] bottom-0 bg-gradient-to-b from-[#6b625b] to-[#4c4540]" />

          {/* the coach */}
          <div className="absolute left-[5cqh] top-[18cqh] z-20 h-[46.5cqh] w-[150cqh]">
            <div key={stage.kind === "arriving" ? "arrive" : "coach"} className={`h-full ${coachMotion}`}>
              <div ref={kickRef} className="relative h-full w-full" style={{ transformOrigin: "50% 100%" }}>
                <CoachBody virarFast={!!shown?.virarFast} />
                {closing &&
                  DOORS.map(x => (
                    <div
                      key={x}
                      className="absolute overflow-hidden"
                      style={{ ...pct(x, 40), width: "8%", height: `${(208 / 310) * 100}%` }}
                    >
                      <div className="rush-door-left absolute inset-y-0 left-0 w-1/2 border-r-[0.3cqh] border-[#1a0f0a] bg-[#8f9396]/85" />
                      <div className="rush-door-right absolute inset-y-0 right-0 w-1/2 border-l-[0.3cqh] border-[#1a0f0a] bg-[#8f9396]/85" />
                    </div>
                  ))}
                {riders.slice(0, SLOTS.length).map((r, i) => {
                  const slot = SLOTS[i];
                  const isMe = sameAddress(r.address, me);
                  const fresh = !leaving && latestSeats.has(r.seat);
                  return (
                    <div key={`${shown?.trainId}-${r.seat}`} className="contents">
                      {isMe && (
                        <div
                          className="rush-you-glow pointer-events-none absolute h-[16cqh] w-[16cqh] rounded-full"
                          style={{ ...pct(slot.x, slot.y + 6), zIndex: 99 }}
                        />
                      )}
                      <Figure
                        name={r.name}
                        scale={isMe ? Math.max(scale, 1) : scale}
                        teamwork={r.teamwork}
                        hangOut={slot.hangOut}
                        className={fresh ? "rush-pop" : ""}
                        tagClassName={isMe ? "hidden" : undefined}
                        style={{ ...pct(slot.x, slot.y), zIndex: isMe ? 100 : r.seat }}
                      />
                      {isMe && (
                        <div
                          className="pointer-events-none absolute z-[101] whitespace-nowrap rounded-[1cqh] border-[0.5cqh] border-[#1a0f0a] bg-[#ffd200] px-[1.4cqh] font-display text-[5cqh] font-extrabold leading-[1.2] text-[#1a0f0a] shadow-[0_0.6cqh_0_#1a0f0a]"
                          style={{ ...pct(slot.x, slot.y - 52), transform: "translate(-50%, -50%)" }}
                        >
                          YOU ▾
                        </div>
                      )}
                    </div>
                  );
                })}
                {hanger && (
                  <>
                    {hangerIsMe && !hanger.falling && (
                      <div
                        className="rush-you-glow pointer-events-none absolute z-[59] h-[18cqh] w-[18cqh] rounded-full"
                        style={pct(HANGER_SLOT.x, HANGER_SLOT.y + 10)}
                      />
                    )}
                    <Figure
                      key={hanger.address}
                      name={hanger.name}
                      scale={1.1}
                      hangOut
                      className={hanger.falling ? "rush-fall" : "rush-swing"}
                      tagClassName={`-mt-[0.6cqh] max-w-[22cqh] truncate rounded-[0.8cqh] border-[0.4cqh] border-[#1a0f0a] px-[1cqh] font-display text-[4.4cqh] font-extrabold leading-[1.25] ${
                        hangerIsMe ? "bg-[#ffd200] text-[#1a0f0a]" : "bg-[#ef4444] text-white"
                      }`}
                      style={{ ...pct(HANGER_SLOT.x, HANGER_SLOT.y), zIndex: 60 }}
                    />
                    {!hanger.falling && activeHanger && hangTotal?.until === activeHanger.until && (
                      <HangRing left={activeHanger.until - now} total={hangTotal.total} />
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* captions over the roof line */}
          <div className="pointer-events-none absolute inset-x-[3cqh] top-[2cqh] z-40 flex h-[16cqh] items-center justify-center">
            {hangerIsMe && !hanger?.falling ? (
              <div className="rush-pulse rounded-[1.2cqh] border-[0.5cqh] border-[#1a0f0a] bg-[#ef4444] px-[2cqh] py-[0.4cqh] text-center font-display text-[5.6cqh] font-extrabold leading-tight text-white">
                Hold on! One more push gets you in
              </div>
            ) : hanger && !hanger.falling && !caption ? (
              <div className="rush-pulse max-w-full truncate rounded-[1.2cqh] border-[0.5cqh] border-[#1a0f0a] bg-[#ef4444] px-[2cqh] py-[0.4cqh] text-center font-display text-[5.6cqh] font-extrabold leading-tight text-white">
                {hanger.name} needs one more push!
              </div>
            ) : caption ? (
              <div
                key={caption.id}
                className={`rush-caption rush-stroke whitespace-nowrap font-display text-[11cqh] font-extrabold ${
                  caption.tone === "fall" ? "text-[#ff6b5e]" : caption.tone === "horn" ? "text-white" : "text-[#ffd200]"
                }`}
                style={{ ["--d" as string]: caption.tone === "horn" ? "3s" : "2.2s" }}
              >
                {caption.text}
              </div>
            ) : pushing ? (
              <div className="rush-stroke font-display text-[10cqh] font-extrabold text-[#ffd200]">Aage chalo!</div>
            ) : null}
          </div>
        </div>
      </div>
      {rodeOff !== null && (
        <div className="mx-4 mt-2 rounded-xl border-4 border-[#1a0f0a] bg-[#fdf3d0] px-3 py-2 text-center font-display text-base font-extrabold text-[#1a0f0a]">
          Your train #{String(rodeOff)} left. Your ticket is in My tickets
        </div>
      )}
    </div>
  );
};
