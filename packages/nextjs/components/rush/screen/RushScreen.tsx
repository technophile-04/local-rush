"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fliesAtMahim, hasDeparted, sameAddress, useNow } from "../rush";
import { CrowdMeter, IndicatorBoard, PlatformBoard, StationBoard, StatsStrip } from "./Boards";
import { Cameos } from "./Cameos";
import { Coach } from "./Coach";
import { JoinCorner } from "./JoinCorner";
import { useRushSound } from "./sound";
import { useIsMock, useRush } from "~~/hooks/rush/useRush";
import type { DoorHanger, TrainView } from "~~/types/rush";

const LEAVE_MS = 5500;
const ARRIVE_MS = 3000;
const MAHIM_AT_MS = 900;
const CAPTION_MS = 2800;
// Fits a caption on its plate inside the headline band (~140cqh wide, 1.12× mid-animation).
const captionSize = (text: string) => Math.min(5.8, 200 / text.length);
// Dark plate so captions read from the back of the room against the peach wall.
const PLATE =
  "rush-caption whitespace-nowrap rounded-[1.4cqh] border-[0.5cqh] bg-[#1a0f0a]/90 px-[2.4cqh] py-[0.3cqh] text-center font-extrabold leading-[1.2] shadow-[0_0.8cqh_0_rgba(0,0,0,0.45)]";

type Stage = { kind: "live" } | { kind: "leaving"; snapshot: TrainView } | { kind: "arriving" };
type Caption = { id: number; text: string; teamwork: boolean; tone: "board" | "fall" };

/**
 * Decides what the coach shows. A train leaves on screen when `departsAt` passes (or it fills)
 * while it is still the current train, or when `trainId` changes before we animated the old one.
 */
const useDeparture = (train: TrainView | null, now: number, onLeave: () => void, onArrive: () => void) => {
  const [stage, setStage] = useState<Stage>({ kind: "live" });
  const [mahim, setMahim] = useState(false);
  const [left, setLeft] = useState<ReadonlySet<bigint>>(new Set());
  const lastLive = useRef<TrainView | null>(null);
  const callbacks = useRef({ onLeave, onArrive });
  useEffect(() => {
    callbacks.current = { onLeave, onArrive };
  }, [onLeave, onArrive]);

  useEffect(() => {
    if (!train || stage.kind !== "live") return;
    const prev = lastLive.current;
    let leaving: TrainView | null = null;
    const departing = prev && prev.trainId !== train.trainId && !left.has(prev.trainId) ? prev : null;
    // Riders who boarded after our last poll are only in the feed's final list for that train.
    const finalRiders = departing && train.lastDeparted?.trainId === departing.trainId && train.lastDeparted.riderList;
    if (departing && finalRiders) leaving = { ...departing, riders: finalRiders };
    else if (departing && departing.riders.length > 0) leaving = departing;
    else if (hasDeparted(train, now) && !left.has(train.trainId)) leaving = train;
    if (!left.has(train.trainId)) lastLive.current = train;
    if (leaving) {
      const gone = leaving.trainId;
      setLeft(s => new Set(s).add(gone));
      setStage({ kind: "leaving", snapshot: leaving });
      callbacks.current.onLeave();
    }
  }, [train, now, stage.kind, left]);

  useEffect(() => {
    if (stage.kind === "leaving") {
      const m = setTimeout(() => setMahim(true), MAHIM_AT_MS);
      const t = setTimeout(() => {
        setMahim(false);
        setStage({ kind: "arriving" });
        callbacks.current.onArrive();
      }, LEAVE_MS);
      return () => {
        clearTimeout(m);
        clearTimeout(t);
      };
    }
    if (stage.kind === "arriving") {
      const t = setTimeout(() => setStage({ kind: "live" }), ARRIVE_MS);
      return () => clearTimeout(t);
    }
  }, [stage]);

  const waiting = !train || left.has(train.trainId);
  return { stage, mahim, waiting };
};

export const RushScreen = () => {
  const { train, stats } = useRush();
  const isMock = useIsMock();
  const now = useNow();
  const sound = useRushSound();
  const { stage, mahim, waiting } = useDeparture(train, now, sound.horn, sound.chime);
  const leaving = stage.kind === "leaving" ? stage.snapshot : null;
  const shown = leaving ?? (waiting ? null : train);

  // New riders → pop + "Chadh gaya!" caption.
  const [latestSeats, setLatestSeats] = useState<Set<number>>(new Set());
  const [caption, setCaption] = useState<Caption | null>(null);
  const seen = useRef<{ trainId: bigint; count: number } | null>(null);
  useEffect(() => {
    if (!train) return;
    const prev = seen.current;
    const from = prev && prev.trainId === train.trainId ? prev.count : 0;
    seen.current = { trainId: train.trainId, count: train.riders.length };
    if (!prev || train.riders.length <= from) return; // first load shows the coach as-is
    const fresh = train.riders.slice(from);
    setLatestSeats(new Set(fresh.map(r => r.seat)));
    const teamwork = fresh.some(r => r.teamwork);
    const names = fresh.length <= 2 ? fresh.map(r => r.name).join(" & ") : `${fresh[0].name} +${fresh.length - 1} more`;
    setCaption({
      id: Date.now(),
      text: `${teamwork ? "TEAMWORK PUSH" : "Chadh gaya!"} — ${names}`,
      teamwork,
      tone: "board",
    });
    sound.pop();
    // sound identity changes with `enabled`; we only want to react to new riders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [train]);

  // Door hanger: active until `until`; if they never got in, they slide off.
  const [falling, setFalling] = useState<DoorHanger | null>(null);
  const lastHanger = useRef<DoorHanger | null>(null);
  const hangerLive = train?.doorHanger && now <= train.doorHanger.until && !waiting && !hasDeparted(train, now);
  const activeHanger = hangerLive ? train!.doorHanger : null;
  useEffect(() => {
    const prev = lastHanger.current;
    if (activeHanger) {
      lastHanger.current = activeHanger;
      return;
    }
    if (!prev) return;
    lastHanger.current = null;
    const boarded = train?.riders.some(r => sameAddress(r.address, prev.address));
    const sameTrainExpired =
      train?.doorHanger && sameAddress(train.doorHanger.address, prev.address) && now > prev.until;
    if (!boarded && (sameTrainExpired || !train?.doorHanger)) {
      setFalling(prev);
      setCaption({
        id: Date.now(),
        text: `${prev.name} fell off! Back to the platform`,
        teamwork: false,
        tone: "fall",
      });
      setTimeout(() => setFalling(null), 1600);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeHanger?.address, activeHanger?.until]);

  useEffect(() => {
    if (!caption) return;
    const t = setTimeout(() => setCaption(null), CAPTION_MS);
    return () => clearTimeout(t);
  }, [caption]);

  const flyers = useMemo(
    () =>
      leaving && mahim
        ? new Set(leaving.riders.filter(r => fliesAtMahim(leaving.trainId, r.seat)).map(r => r.seat))
        : null,
    [leaving, mahim],
  );

  const closing =
    stage.kind === "live" && !!shown && shown.departsAt > 0 && shown.departsAt - now <= 10 && shown.departsAt - now > 0;
  const virarFast = !!shown?.virarFast;
  const hangerView = activeHanger
    ? { ...activeHanger, falling: false }
    : falling
      ? { ...falling, falling: true }
      : null;

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-[#1a120e]">
      <div
        className="rush-stage relative overflow-hidden font-display text-white select-none"
        style={{ width: "min(100vw, 177.78vh)", height: "min(100vh, 56.25vw)" }}
      >
        {/* backdrop: platform roof, hazy far side, overhead wire, track, platform */}
        <div className="absolute inset-x-0 top-0 h-[19cqh] bg-gradient-to-b from-[#2b211c] to-[#3d3029]" />
        <div className="absolute inset-x-0 top-[19cqh] h-[50cqh] bg-gradient-to-b from-[#f3c58f] via-[#e8b07a] to-[#c98e5d]" />
        <div className="absolute inset-x-0 top-[23.5cqh] h-[0.35cqh] bg-[#2b211c]" />
        {[30, 90, 150].map(x => (
          <div
            key={x}
            className="absolute top-[19cqh] h-[50cqh] w-[1.4cqh] bg-[#5b6b5f]/60"
            style={{ left: `${x}cqh` }}
          />
        ))}
        <div className="absolute inset-x-0 top-[66cqh] h-[6cqh] bg-[#3a3330]" />
        <div className="absolute inset-x-0 top-[71.5cqh] h-[3cqh] border-y-[0.3cqh] border-[#1a0f0a] bg-[#ffd200] bg-[radial-gradient(circle,#c79f00_25%,transparent_27%)] bg-[length:2cqh_2cqh]" />
        <div className="absolute inset-x-0 top-[74.5cqh] bottom-0 bg-gradient-to-b from-[#6b625b] to-[#4c4540]" />

        {/* 1. indicator board, 2. station boards */}
        <div className="absolute left-[1.5cqh] top-[1cqh] h-[16.5cqh] w-[110cqh]">
          <IndicatorBoard train={leaving ?? train} now={now} leaving={!!leaving} waiting={!leaving && waiting} />
        </div>
        <div className="absolute left-[113cqh] top-[1cqh] flex h-[16.5cqh] gap-[1.4cqh]">
          <StationBoard devanagari="डेवकॉन" name="DEVCON" />
          <PlatformBoard />
        </div>

        {/* wall poster, or the MAHIM board while leaving */}
        <div className="absolute left-[2cqh] top-[18cqh] z-10">
          {leaving ? (
            <div>
              <StationBoard devanagari="माहीम" name="MAHIM" small />
            </div>
          ) : (
            <div className="-rotate-3 rounded-[0.4cqh] border-[0.4cqh] border-[#1a0f0a] bg-[#7c3aed] px-[1.6cqh] py-[0.6cqh] text-center font-display font-extrabold leading-none text-white shadow-[0_0.8cqh_1.5cqh_rgba(0,0,0,0.4)]">
              <div className="text-[4.4cqh]">DEVCON 8</div>
              <div className="text-[2.6cqh] tracking-[0.3em] text-[#ffd200]">MUMBAI</div>
            </div>
          )}
        </div>

        {/* 3. the coach */}
        <div className="absolute left-[9cqh] top-[22cqh] z-20 h-[49.6cqh] w-[160cqh]">
          <div
            key={stage.kind === "arriving" ? "arrive" : "coach"}
            className={leaving ? "rush-leave h-full" : stage.kind === "arriving" ? "rush-arrive h-full" : "h-full"}
          >
            <div className={`h-full ${virarFast && !leaving ? "rush-shake" : ""}`}>
              <Coach
                trainId={shown?.trainId ?? null}
                riders={shown?.riders ?? []}
                capacity={shown?.capacity ?? 30}
                virarFast={virarFast}
                latestSeats={leaving ? new Set() : latestSeats}
                hanger={leaving ? null : hangerView}
                closing={closing}
                flyers={flyers}
              />
            </div>
          </div>
        </div>

        {/* headline band (18.5–27cqh): door hanger banner > Mahim > captions. Cameos stay out of it. */}
        <div className="pointer-events-none absolute left-[30cqh] right-[2cqh] top-[18.5cqh] z-40 flex justify-center">
          {activeHanger && !leaving ? (
            <div className="rush-pulse flex items-center gap-[2cqh] rounded-[1.4cqh] border-[0.6cqh] border-[#1a0f0a] bg-[#ef4444] px-[2.4cqh] py-[0.6cqh] shadow-[0_0.8cqh_0_#1a0f0a]">
              <div className="flex flex-col leading-none">
                <span className="text-[7cqh] font-extrabold">TEAMWORK PUSH needed!</span>
                <span className="mt-[0.4cqh] text-[3.4cqh] font-extrabold text-[#ffd200]">
                  {activeHanger.name} is hanging at the door. One more push boards both
                </span>
              </div>
              <div className="flex h-[10cqh] w-[10cqh] shrink-0 items-center justify-center rounded-full border-[0.6cqh] border-[#1a0f0a] bg-[#ffd200] text-[6.4cqh] font-extrabold text-[#1a0f0a]">
                {Math.max(0, Math.ceil(activeHanger.until - now))}
              </div>
            </div>
          ) : leaving && flyers && flyers.size > 0 ? (
            <div
              key="mahim"
              className={`${PLATE} border-[#ffd200] text-[6cqh] text-[#ffd200]`}
              style={{ ["--d" as string]: "4s" }}
            >
              Bhai, Mahim nahi!
            </div>
          ) : leaving ? (
            <div
              key="paam"
              className={`${PLATE} border-white text-[6cqh] text-white`}
              style={{ ["--d" as string]: "3s" }}
            >
              PAAAM!
            </div>
          ) : (
            caption && (
              <div
                key={caption.id}
                className={`${PLATE} max-w-full ${
                  caption.teamwork
                    ? "border-[#ef4444] text-[#ffd200]"
                    : caption.tone === "fall"
                      ? "border-[#ff6b5e] text-[#ff6b5e]"
                      : "border-[#ffd200] text-[#ffd200]"
                }`}
                style={{ fontSize: `${captionSize(caption.text)}cqh` }}
              >
                {caption.text}
              </div>
            )
          )}
        </div>

        <Cameos paused={!!leaving} quiet={!!caption || !!activeHanger} chatterAnchors={shown?.riders.length ?? 0} />

        {/* 5. crowd meter, 10. stats, 9. join corner */}
        <div className="absolute inset-x-[2cqh] bottom-[1.5cqh] top-[76cqh] z-30 flex gap-[3cqh]">
          <div className="min-w-0 flex-1">
            <CrowdMeter riders={shown?.riders.length ?? 0} capacity={shown?.capacity ?? 30} virarFast={virarFast} />
          </div>
          {stats && (
            <div className="min-w-0 flex-1">
              <StatsStrip stats={stats} />
            </div>
          )}
          <div className="w-[50cqh] shrink-0">
            <JoinCorner mock={isMock} />
          </div>
        </div>

        {/* 11. sound */}
        <button
          onClick={sound.enable}
          className={`absolute left-[1.5cqh] top-[71.7cqh] z-40 rounded-full border-[0.3cqh] border-[#1a0f0a] px-[1.2cqh] font-display text-[2cqh] font-extrabold leading-[1.3] text-[#1a0f0a] ${
            sound.enabled ? "bg-white/70" : "rush-pulse bg-white"
          }`}
        >
          {sound.enabled ? "🔊 Sound on" : "🔈 Tap for sound"}
        </button>
      </div>
    </div>
  );
};
