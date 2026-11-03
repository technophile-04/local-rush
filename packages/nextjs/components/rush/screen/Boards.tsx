import { CROWD_STOPS, crowdLevel, dueLabel, indicatorTime } from "../rush";
import type { RushStats, TrainView } from "~~/types/rush";

const ANNOUNCEMENT =
  "Pudhil station Dadar · Agla station Dadar · Next station Dadar · Kripya darwaze se hatkar khade rahein · Please stand away from the doors · ";

const COLS = "grid grid-cols-[17cqh_1fr_9cqh_11cqh_19cqh] items-baseline gap-x-[2cqh]";

type IndicatorProps = {
  train: TrainView | null;
  now: number;
  leaving: boolean;
  waiting: boolean; // the old train left; the next one has no rider yet
};

/** Black platform indicator with amber LED dot-matrix text, Mumbai format. */
export const IndicatorBoard = ({ train, now, leaving, waiting }: IndicatorProps) => {
  const started = !!train && train.departsAt > 0 && !waiting;
  const secondsLeft = started ? train.departsAt - now : 0;
  const fast = !!train?.virarFast && !waiting;
  const time = fast ? "8.15" : started ? indicatorTime(train.departsAt) : "-.--";
  const destination = waiting || !train ? "NEXT TRAIN" : fast ? "VIRAR FAST" : train.destination;
  const due = leaving ? "GONE" : started ? dueLabel(secondsLeft) : "READY";
  const urgent = started && !leaving && secondsLeft <= 10;
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[1cqh] border-[0.6cqh] border-[#2a2a2a] bg-black px-[2cqh] py-[0.4cqh] shadow-[0_1cqh_2cqh_rgba(0,0,0,0.5)]">
      <div className={`${COLS} font-display text-[2.4cqh] font-bold tracking-wide text-[#c98a1a]`}>
        <span>TIME</span>
        <span>DESTINATION</span>
        <span>F/S</span>
        <span>CARS</span>
        <span className="flex justify-between">
          DUE
          <span className="text-[#c98a1a]">{train ? `#${train.trainId}` : ""}</span>
        </span>
      </div>
      <div
        className={`${COLS} font-led text-[6cqh] font-black leading-[1.05] ${
          fast ? "rush-flash-red" : "text-[#ffb000] [text-shadow:0_0_1cqh_#ff8c00]"
        }`}
      >
        <span>{time}</span>
        <span className="truncate">{destination}</span>
        <span>{fast ? "F" : "S"}</span>
        <span>12</span>
        <span className={urgent || leaving ? "rush-blink" : ""}>{due}</span>
      </div>
      <div className="mt-[0.4cqh] overflow-hidden whitespace-nowrap border-t-[0.3cqh] border-[#3a2a00] pt-[0.2cqh] font-led text-[3cqh] leading-[1.15] font-black text-[#ffb000]">
        <div className="rush-ticker inline-block">
          {waiting || !started ? "Scan the QR and push to board · " : ""}
          {ANNOUNCEMENT}
          {waiting || !started ? "Scan the QR and push to board · " : ""}
          {ANNOUNCEMENT}
        </div>
      </div>
    </div>
  );
};

/** The classic yellow station board: Marathi, Hindi, English. */
export const StationBoard = ({
  name,
  marathi,
  hindi,
  small,
}: {
  name: string;
  marathi: string;
  hindi: string;
  small?: boolean;
}) => (
  <div
    className={`flex flex-col items-center justify-center rounded-[0.6cqh] border-[0.6cqh] border-[#1a0f0a] bg-[#ffd200] font-display font-extrabold text-[#111] shadow-[0_1cqh_2cqh_rgba(0,0,0,0.45)] ${
      small ? "px-[2cqh] py-[0.4cqh]" : "px-[3cqh] py-[0.4cqh]"
    }`}
  >
    <span className={`${small ? "text-[3cqh]" : "text-[3.6cqh]"} leading-[1.15]`}>{marathi}</span>
    <span className={`${small ? "text-[3cqh]" : "text-[3.6cqh]"} leading-[1.15]`}>{hindi}</span>
    <span className={`${small ? "text-[3.8cqh]" : "text-[5cqh]"} leading-[1] tracking-[0.12em]`}>{name}</span>
  </div>
);

export const PlatformBoard = () => (
  <div className="flex flex-col items-center justify-center rounded-[0.6cqh] border-[0.6cqh] border-[#1a0f0a] bg-[#1e3a8a] px-[1.6cqh] py-[0.6cqh] font-display font-extrabold leading-none text-white shadow-[0_1cqh_2cqh_rgba(0,0,0,0.45)]">
    <span className="text-[2.4cqh] tracking-wider">PLATFORM</span>
    <span className="text-[10cqh] leading-[0.95]">8</span>
  </div>
);

type MeterProps = { riders: number; capacity: number; virarFast: boolean };

/** Four-stop crowd gauge. On a Virar Fast it starts angry. */
export const CrowdMeter = ({ riders, capacity, virarFast }: MeterProps) => {
  const level = crowdLevel(riders, capacity);
  const shown = virarFast ? { ...CROWD_STOPS[3], index: 3 } : level;
  return (
    <div className={`flex h-full flex-col justify-center gap-[0.8cqh] ${virarFast ? "rush-shake" : ""}`}>
      <div className="flex items-baseline justify-between font-display font-extrabold leading-none">
        <span className="text-[2.6cqh] tracking-wide text-white/85">CROWD METER</span>
        <span className="text-[3.4cqh] text-white">
          {riders}/{capacity}
        </span>
      </div>
      <div
        className="rounded-[0.8cqh] border-[0.4cqh] border-[#1a0f0a] px-[1.4cqh] font-display text-[5cqh] font-extrabold leading-[1.2] text-[#1a0f0a]"
        style={{ background: shown.color }}
      >
        {virarFast ? "VIRAR FAST: Angry!" : shown.label}
      </div>
      <div className="grid grid-cols-[1.3fr_1fr_1fr_1fr] gap-[0.6cqh]">
        {CROWD_STOPS.map((s, i) => (
          <div
            key={s.label}
            className={`flex h-[6.2cqh] items-center justify-center rounded-[0.6cqh] border-[0.35cqh] px-[0.4cqh] text-center font-display text-[2.5cqh] font-extrabold leading-[1.05] ${
              i === shown.index
                ? "border-white text-[#1a0f0a]"
                : i < shown.index
                  ? "border-[#1a0f0a] text-[#1a0f0a]"
                  : "border-[#1a0f0a] text-white/70"
            }`}
            style={{ background: i <= shown.index ? s.color : "rgba(0,0,0,0.35)" }}
          >
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
};

/** Running totals plus the last few departures as mini indicator rows. */
export const StatsStrip = ({ stats }: { stats: RushStats }) => (
  <div className="flex h-full flex-col justify-center gap-[1cqh]">
    <div className="grid grid-cols-3 gap-[1cqh] text-center font-display font-extrabold leading-none text-white">
      {[
        ["Trains today", stats.trainsDeparted],
        ["People boarded", stats.ridersTotal],
        ["Teamwork pushes", stats.teamworkPushes],
      ].map(([label, value]) => (
        <div key={label} className="rounded-[0.8cqh] bg-black/35 px-[0.6cqh] py-[0.8cqh]">
          <div className="text-[5.4cqh] text-[#ffd200]">{value}</div>
          <div className="mt-[0.4cqh] text-[2.5cqh] text-white/90">{label}</div>
        </div>
      ))}
    </div>
    <div className="flex flex-col gap-[0.3cqh] rounded-[0.6cqh] bg-black px-[1.2cqh] py-[0.6cqh] font-led text-[2.8cqh] font-black leading-[1.1] text-[#ffb000]">
      {stats.recentTrains.length === 0 && <span>No departures yet</span>}
      {stats.recentTrains.slice(0, 3).map(t => (
        <div key={String(t.trainId)} className={`flex justify-between ${t.virarFast ? "text-[#ff5a4f]" : ""}`}>
          <span>#{String(t.trainId)}</span>
          <span className="flex-1 px-[1.5cqh]">{t.virarFast ? "VIRAR FAST" : t.destination}</span>
          <span>{t.riders} riders · GONE</span>
        </div>
      ))}
    </div>
  </div>
);
