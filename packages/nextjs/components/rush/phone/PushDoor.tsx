"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** open: tap to push · pushing: you're squeezing in · crowded: you're aboard or hanging · closed: can't push yet */
export type DoorLook = "open" | "pushing" | "crowded" | "closed";

/** How hard this door is to get through: taps to fill the meter, and how fast the crowd shoves it back. */
export type PushEffort = { taps: number; drainPerSec: number };

type PushDoorProps = {
  look: DoorLook;
  effort: PushEffort;
  sign?: string; // small plate under the door, e.g. "You're on this train"
  onTap?: () => void; // every shove, so the coach can squeeze along
  onPush: () => void; // fires once, when the meter fills
};

const HOLD_AFTER_MS = 250; // a press held this long starts filling on its own
const HOLD_SEC_PER_TAP = 0.32; // holding fills a bit slower than mashing
const DRAIN_AFTER_MS = 250; // the crowd shoves back once you pause

// The commuters right at the door who shove back, as [left %, size %, which way they give way].
const SHOVERS: [number, number, number][] = [
  [-6, 46, -1],
  [56, 48, 1],
];

// A few riders packed inside the doorway, as [left %, top %, size %, shade].
const CROWD: [number, number, number, string][] = [
  [8, 30, 26, "#3a2a22"],
  [66, 26, 28, "#33241d"],
  [30, 40, 24, "#2e201a"],
  [52, 46, 22, "#3d2c24"],
];
const PACKED: [number, number, number, string][] = [
  ...CROWD,
  [2, 52, 30, "#4a352b"],
  [70, 50, 30, "#46322a"],
  [20, 62, 32, "#55402f"],
  [50, 64, 32, "#5a4433"],
];

const Rider = ([x, y, s, c]: [number, number, number, string]) => (
  <div key={`${x}-${y}`} className="absolute" style={{ left: `${x}%`, top: `${y}%`, width: `${s}%` }}>
    <div className="mx-auto aspect-square w-[46%] rounded-full" style={{ background: c }} />
    <div className="-mt-[8%] aspect-[2/1] w-full rounded-t-full" style={{ background: c }} />
  </div>
);

export const PushDoor = ({ look, effort, sign, onTap, onPush }: PushDoorProps) => {
  const canPush = look === "open";
  const [meter, setMeter] = useState(0);
  const [kicks, setKicks] = useState(0);
  const [holding, setHolding] = useState(false);
  const meterRef = useRef(0);
  const fired = useRef(false);
  const press = useRef({ down: false, at: 0, lastTap: 0 });
  const onPushRef = useRef(onPush);
  useEffect(() => {
    onPushRef.current = onPush;
  }, [onPush]);

  // The one place the meter moves; the real push fires exactly once, when it fills.
  const apply = useCallback((next: number) => {
    if (fired.current) return;
    const m = Math.max(0, Math.min(1, next));
    if (m === meterRef.current) return;
    meterRef.current = m;
    setMeter(m);
    if (m >= 1) {
      fired.current = true;
      press.current.down = false;
      setHolding(false);
      onPushRef.current();
    }
  }, []);

  // A door that opens again (new train, or the push failed) starts from an empty meter.
  useEffect(() => {
    if (!canPush) return;
    fired.current = false;
    meterRef.current = 0;
    setMeter(0);
  }, [canPush]);

  // Holding fills, pausing drains.
  useEffect(() => {
    if (!canPush) return;
    let last = performance.now();
    const id = setInterval(() => {
      const t = performance.now();
      const dt = (t - last) / 1000;
      last = t;
      const p = press.current;
      if (p.down && t - p.at > HOLD_AFTER_MS) apply(meterRef.current + dt / (effort.taps * HOLD_SEC_PER_TAP));
      else if (!p.down && t - p.lastTap > DRAIN_AFTER_MS) apply(meterRef.current - dt * effort.drainPerSec);
    }, 50);
    return () => clearInterval(id);
  }, [canPush, effort.taps, effort.drainPerSec, apply]);

  const tap = () => {
    if (!canPush || fired.current) return;
    press.current.lastTap = performance.now();
    navigator.vibrate?.(10);
    setKicks(k => k + 1);
    onTap?.();
    apply(meterRef.current + 1 / effort.taps);
  };
  const release = () => {
    press.current.down = false;
    setHolding(false);
  };

  const grabbing = (holding && canPush) || look === "pushing";
  const shoving = canPush || look === "pushing";
  const shown = look === "pushing" ? 1 : meter;
  const ladder =
    // The chain hasn't answered yet: you might board or end up hanging, so don't promise "Chadh gaya!".
    look === "pushing"
      ? "Pushing…"
      : canPush && meter > 0
        ? meter < 0.5
          ? "Aage chalo!"
          : "Thoda adjust karo"
        : null;

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        aria-label="Push"
        aria-describedby={sign ? "push-door-sign" : undefined}
        disabled={!canPush}
        onPointerDown={() => {
          press.current = { ...press.current, down: true, at: performance.now() };
          setHolding(true);
          tap();
        }}
        onPointerUp={release}
        onPointerLeave={release}
        onPointerCancel={release}
        onContextMenu={e => e.preventDefault()}
        // keyboard (Enter / Space) arrives as a click with no pointer
        onClick={e => e.detail === 0 && tap()}
        className={`group relative h-[19rem] w-64 select-none touch-manipulation ${
          look === "pushing" || (holding && canPush) ? "rush-door-lurch" : ""
        }`}
      >
        <div key={kicks} className={`absolute inset-0 ${kicks > 0 && canPush ? "rush-door-kick" : ""}`}>
          {/* today's WR local: off-white body, magenta stripe and door panels, light grey frames */}
          <div
            className={`absolute inset-0 overflow-hidden rounded-t-[2.2rem] rounded-b-lg border-[5px] border-[#1a0f0a] bg-[#f3f1ee] shadow-[0_12px_0_#1a0f0a]`}
          >
            <div className={`absolute inset-x-0 top-0 h-[4.6rem] bg-[#f3f1ee]`}>
              <div className={`absolute inset-x-0 top-2 h-2 bg-[#a8175f]`} />
              <div
                className={`absolute inset-x-0 top-[1.15rem] text-center font-display text-[2.9rem] font-extrabold leading-none tracking-[0.28em] ${
                  canPush ? `text-[#a8175f]` : `text-[#a8175f]/50`
                }`}
                style={{
                  WebkitMaskImage: "linear-gradient(to bottom, #000 0 47%, transparent 47% 55%, #000 55%)",
                  maskImage: "linear-gradient(to bottom, #000 0 47%, transparent 47% 55%, #000 55%)",
                  paddingLeft: "0.28em",
                }}
              >
                PUSH
              </div>
            </div>
            {/* rivets and grime */}
            <div className="absolute inset-x-3 top-[4.9rem] flex justify-between">
              {[0, 1, 2, 3, 4, 5].map(i => (
                <span key={i} className={`h-1.5 w-1.5 rounded-full bg-[#9ca3af]`} />
              ))}
            </div>
            {/* the slid-back magenta door panels either side, each with a tall narrow window */}
            {["left-0", "right-0"].map(side => (
              <div
                key={side}
                className={`absolute ${side} top-[4.95rem] bottom-[1.5rem] w-[1.45rem] border-y-[3px] border-[#c9ccd0] bg-[#a8175f]`}
              >
                <div
                  className={`mx-auto mt-3 h-[55%] w-[0.45rem] rounded-full border-2 border-[#c9ccd0] bg-[#1f2a33]`}
                />
              </div>
            ))}
            <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/20 to-transparent" />
          </div>

          {/* the doorway */}
          <div
            className={`absolute inset-x-[1.6rem] top-[5.4rem] bottom-[2.1rem] overflow-hidden rounded-t-md border-[4px] border-[#1a0f0a] outline outline-[4px] outline-[#c9ccd0] bg-gradient-to-b from-[#120c0a] via-[#1f1512] to-[#2b1f1a]`}
          >
            {/* ceiling light and the crowd inside */}
            <div className="absolute inset-x-6 top-1 h-1.5 rounded-full bg-[#fff7d6]/70 blur-[1px]" />
            <div className={look === "crowded" || look === "pushing" ? "rush-crowd-sway" : ""}>
              {(look === "crowded" || look === "pushing" ? PACKED : CROWD).map(Rider)}
            </div>
            {/* the people right at the door shove back, then give way as the meter climbs */}
            {shoving &&
              SHOVERS.map(([x, size, way]) => (
                <div
                  key={x}
                  className="absolute bottom-[-8%] transition-transform duration-200 ease-out"
                  style={{
                    left: `${x}%`,
                    width: `${size}%`,
                    transform: `translateX(${way * shown * 60}%) scale(${1.12 - 0.3 * shown})`,
                    transformOrigin: "50% 100%",
                  }}
                >
                  <div key={kicks} className={`relative ${kicks > 0 && canPush ? "rush-shove" : ""}`}>
                    {Rider([0, 0, 100, "#6b4a38"])}
                    <div className="aspect-square w-full" />
                  </div>
                </div>
              ))}
            {/* hands on the overhead rail */}
            <div className="absolute inset-x-0 top-5 h-1 bg-[#9ca3af]/60" />
            {[18, 70].map(x => (
              <div key={x} className="absolute top-4 h-3 w-2.5 rounded-sm bg-[#c68642]/70" style={{ left: `${x}%` }} />
            ))}

            {/* worn yellow edge strips */}
            {["left-0", "right-0"].map(side => (
              <div
                key={side}
                className={`absolute inset-y-0 ${side} w-3 bg-[#ffd200]`}
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(to bottom, transparent 0 22px, rgb(120 90 0 / 0.45) 22px 25px, transparent 25px 41px, rgb(0 0 0 / 0.25) 41px 43px)",
                }}
              />
            ))}

            {/* the steel grab pole */}
            <div
              className={`absolute bottom-0 left-1/2 top-0 w-[14px] -translate-x-1/2 origin-bottom ${
                grabbing ? "rush-pole-flex" : kicks > 0 && canPush ? "rush-pole-kick" : ""
              }`}
            >
              <div className="h-full w-full rounded-full border-2 border-[#1a0f0a] bg-[linear-gradient(to_right,#4b5563,#e5e7eb_35%,#ffffff_45%,#9ca3af_65%,#374151)]">
                {[18, 41, 63, 80].map(y => (
                  <span
                    key={y}
                    className="absolute left-[3px] h-[3px] w-[6px] rounded-full bg-[#3f3f46]/60"
                    style={{ top: `${y}%` }}
                  />
                ))}
              </div>
              {/* your hand, when grabbing */}
              {grabbing && (
                <div className="absolute left-1/2 top-[44%] h-6 w-8 -translate-x-1/2 rounded-lg border-2 border-[#1a0f0a] bg-[#c68642]" />
              )}
            </div>

            {/* closed: magenta sliding door panels with tall narrow windows */}
            {look === "closed" &&
              ["left-0 border-r-2", "right-0 border-l-2"].map(side => (
                <div key={side} className={`absolute inset-y-0 ${side} w-1/2 border-[#1a0f0a] bg-[#a8175f]`}>
                  <div className="mx-auto mt-5 h-[58%] w-[28%] rounded-full border-[3px] border-[#c9ccd0] bg-[#1f2a33]" />
                </div>
              ))}
          </div>

          {/* the push meter, on the footboard */}
          <div className="absolute inset-x-[1.2rem] bottom-[0.55rem] h-6 overflow-hidden rounded-md border-[3px] border-[#1a0f0a] bg-[#3a3330]">
            <div
              className="h-full bg-[#ffd200] bg-[repeating-linear-gradient(135deg,transparent_0_8px,rgb(0_0_0/0.18)_8px_14px)] transition-[width] duration-100 ease-out"
              style={{
                width: `${shown * 100}%`,
                backgroundColor: shown >= 1 ? "#22c55e" : shown > 0.5 ? "#facc15" : "#f97316",
              }}
            />
          </div>

          {ladder && (
            <div
              key={ladder}
              className="rush-ladder pointer-events-none absolute inset-x-0 top-[6.2rem] z-10 text-center font-display text-3xl font-extrabold text-[#ffd200] [paint-order:stroke_fill] [-webkit-text-stroke:6px_#1a0f0a] [text-shadow:0_3px_0_#1a0f0a]"
            >
              {ladder}
            </div>
          )}
        </div>
      </button>

      {sign && (
        <div
          id="push-door-sign"
          className="relative mt-5 rounded-md border-[3px] border-[#1a0f0a] bg-[#0f2a4a] px-5 py-1.5 text-center font-display text-base font-extrabold leading-tight text-white shadow-[0_4px_0_#1a0f0a]"
        >
          <span className="absolute left-1 top-1 h-1 w-1 rounded-full bg-white/60" />
          <span className="absolute right-1 top-1 h-1 w-1 rounded-full bg-white/60" />
          <span className="absolute bottom-1 left-1 h-1 w-1 rounded-full bg-white/60" />
          <span className="absolute bottom-1 right-1 h-1 w-1 rounded-full bg-white/60" />
          {sign}
        </div>
      )}
    </div>
  );
};
