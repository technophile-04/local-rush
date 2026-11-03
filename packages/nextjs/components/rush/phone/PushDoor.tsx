"use client";

import { useState } from "react";

/** open: tap to push · pushing: you're squeezing in · crowded: you're aboard or hanging · closed: can't push yet */
export type DoorLook = "open" | "pushing" | "crowded" | "closed";

type PushDoorProps = {
  look: DoorLook;
  sign?: string; // small plate under the door, e.g. "You're on this train"
  onPush: () => void;
};

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

export const PushDoor = ({ look, sign, onPush }: PushDoorProps) => {
  const [pressed, setPressed] = useState(false);
  const canPush = look === "open";
  const grabbing = (pressed && canPush) || look === "pushing";

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        aria-label="Push"
        aria-describedby={sign ? "push-door-sign" : undefined}
        disabled={!canPush}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        onClick={onPush}
        className={`group relative h-[19rem] w-64 select-none touch-manipulation ${
          look === "pushing" ? "rush-door-lurch" : pressed && canPush ? "translate-y-[6px] scale-[0.985]" : ""
        } transition-transform duration-75`}
      >
        {/* coach body: cream upper band with the stencilled PUSH, maroon below */}
        <div className="absolute inset-0 overflow-hidden rounded-t-[2.2rem] rounded-b-lg border-[5px] border-[#1a0f0a] bg-[#7a1f2b] shadow-[0_12px_0_#1a0f0a]">
          <div className="absolute inset-x-0 top-0 h-[4.6rem] bg-[#f4dc8a]">
            <div className="absolute inset-x-0 top-2 h-2 bg-[#7a1f2b]" />
            <div
              className={`absolute inset-x-0 top-[1.15rem] text-center font-display text-[2.9rem] font-extrabold leading-none tracking-[0.28em] ${
                canPush ? "text-[#7a1f2b]" : "text-[#7a1f2b]/55"
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
              <span key={i} className="h-1.5 w-1.5 rounded-full bg-[#4a1219]" />
            ))}
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/35 to-transparent" />
        </div>

        {/* the doorway */}
        <div className="absolute inset-x-[1.6rem] top-[5.4rem] bottom-[1.6rem] overflow-hidden rounded-t-md border-[4px] border-[#1a0f0a] bg-gradient-to-b from-[#120c0a] via-[#1f1512] to-[#2b1f1a]">
          {/* ceiling light and the crowd inside */}
          <div className="absolute inset-x-6 top-1 h-1.5 rounded-full bg-[#fff7d6]/70 blur-[1px]" />
          <div className={look === "crowded" || look === "pushing" ? "rush-crowd-sway" : ""}>
            {(look === "crowded" || look === "pushing" ? PACKED : CROWD).map(Rider)}
          </div>
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
            className={`absolute bottom-0 left-1/2 top-0 w-[14px] -translate-x-1/2 origin-bottom ${grabbing ? "rush-pole-flex" : ""}`}
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

          {/* closed: sliding door panels with small windows */}
          {look === "closed" &&
            ["left-0 border-r-2", "right-0 border-l-2"].map(side => (
              <div
                key={side}
                className={`absolute inset-y-0 ${side} w-1/2 border-[#1a0f0a] bg-[linear-gradient(to_bottom,#8f9396,#6b6f72)]`}
              >
                <div className="mx-auto mt-6 h-16 w-3/5 rounded-sm border-2 border-[#1a0f0a] bg-[#2b1f1a]/80" />
              </div>
            ))}
        </div>

        {/* footboard */}
        <div className="absolute inset-x-[1.2rem] bottom-[0.9rem] h-3 rounded-sm border-2 border-[#1a0f0a] bg-[#9aa0a6]" />
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
