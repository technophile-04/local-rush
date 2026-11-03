import { type CSSProperties, memo } from "react";
import type { DoorHanger, Rider } from "~~/types/rush";

// Coach geometry in SVG viewBox units: x 0..1000, y -50..260 (pantograph above y=0, wheels below 250).
const VB_TOP = -50;
const VB_H = 310;
const DOORS = [120, 460, 800]; // left edge of each door opening, 80 wide
const DOOR_W = 80;
const MAGENTA = "#a8175f";
const WINDOWS = [35, 215, 295, 375, 555, 635, 715, 895]; // left edge, 70 wide
const WIN_W = 70;

type Slot = { x: number; y: number; hangOut?: boolean };

// Seats fill the coach evenly: window row A, door floor, window row B, door stacks, then hanging out.
const SLOTS: Slot[] = (() => {
  const spread = [1, 4, 2, 5, 0, 7, 3, 6];
  const doorCx = DOORS.map(d => d + DOOR_W / 2);
  const slots: Slot[] = [];
  spread.forEach(i => slots.push({ x: WINDOWS[i] + WIN_W / 2, y: 68 }));
  doorCx.forEach(cx => slots.push({ x: cx - 16, y: 182 }));
  spread.forEach(i => slots.push({ x: WINDOWS[i] + WIN_W / 2 + (i % 2 ? 8 : -8), y: 134 }));
  doorCx.forEach(cx => slots.push({ x: cx + 16, y: 148 }));
  doorCx.forEach(cx => slots.push({ x: cx - 16, y: 114 }));
  doorCx.forEach(cx => slots.push({ x: cx + 14, y: 80 }));
  doorCx.forEach(cx => slots.push({ x: cx + 46, y: 132, hangOut: true }));
  return slots;
})();

const SKINS = ["#8d5524", "#c68642", "#e0ac69", "#a0663a", "#6b3f1f", "#d29a6a"];
const SHIRTS = ["#e11d48", "#2563eb", "#16a34a", "#f59e0b", "#9333ea", "#0891b2", "#ea580c", "#f8fafc", "#db2777"];

const hashName = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

const pct = (x: number, y: number): CSSProperties => ({
  left: `${(x / 1000) * 100}%`,
  top: `${((y - VB_TOP) / VB_H) * 100}%`,
});

type FigureProps = {
  name: string;
  scale: number;
  latest?: boolean;
  teamwork?: boolean;
  hangOut?: boolean;
  className?: string;
  tagClassName?: string;
  style?: CSSProperties;
};

export const Figure = ({
  name,
  scale,
  latest,
  teamwork,
  hangOut,
  className = "",
  tagClassName,
  style,
}: FigureProps) => {
  const h = hashName(name);
  return (
    <div
      className={`absolute flex flex-col items-center ${className}`}
      style={{ transform: `translate(-50%, -50%) scale(var(--s))`, ["--s" as string]: scale, ...style }}
    >
      <div
        className="relative flex flex-col items-center rush-jostle"
        style={{ ["--j" as string]: `${1.2 + (h % 7) / 10}s` }}
      >
        {hangOut && (
          <div className="absolute top-[2.6cqh] -right-[3.4cqh] h-[1.1cqh] w-[4.2cqh] rounded-full bg-[#c68642] border-[0.25cqh] border-[#1a0f0a] -rotate-[25deg]" />
        )}
        <div
          className="relative z-10 h-[5.2cqh] w-[5.2cqh] rounded-full border-[0.35cqh] border-[#1a0f0a]"
          style={{
            background: `linear-gradient(to bottom, #1a1110 0 38%, ${SKINS[h % SKINS.length]} 38% 100%)`,
          }}
        >
          <div className="absolute left-[1.2cqh] top-[2.4cqh] h-[0.6cqh] w-[0.6cqh] rounded-full bg-[#1a0f0a]" />
          <div className="absolute right-[1.2cqh] top-[2.4cqh] h-[0.6cqh] w-[0.6cqh] rounded-full bg-[#1a0f0a]" />
        </div>
        <div
          className="-mt-[0.8cqh] h-[2.6cqh] w-[7cqh] rounded-t-[3cqh] border-[0.35cqh] border-b-0 border-[#1a0f0a]"
          style={{ background: SHIRTS[(h >> 3) % SHIRTS.length] }}
        />
        <div
          className={
            tagClassName ??
            `-mt-[0.6cqh] max-w-[14cqh] truncate rounded-[0.6cqh] border-[0.3cqh] border-[#1a0f0a] px-[0.6cqh] font-display text-[2.8cqh] font-extrabold leading-[1.25] ${
              latest ? "bg-[#ffd200] text-[#1a0f0a]" : "bg-white text-[#1a0f0a]"
            }`
          }
        >
          {teamwork && "★ "}
          {name}
        </div>
      </div>
    </div>
  );
};

const CoachBody = memo(function CoachBody({ virarFast }: { virarFast: boolean }) {
  return (
    <svg viewBox={`0 ${VB_TOP} 1000 ${VB_H}`} className="absolute inset-0 h-full w-full" aria-hidden>
      {/* pantograph */}
      <g stroke="#2b2b2b" strokeWidth="5" fill="none">
        <path d="M430 0 L470 -40 L530 -40 L570 0" />
        <path d="M450 -40 L550 -40" strokeWidth="8" />
      </g>
      {/* roof */}
      <rect x="4" y="0" width="992" height="30" rx="14" fill="#cfd3d8" stroke="#1a0f0a" strokeWidth="4" />
      {/* today's WR livery: off-white body, magenta cant-rail stripe and lower band */}
      <rect x="0" y="20" width="1000" height="230" rx="10" fill="#f3f1ee" stroke="#1a0f0a" strokeWidth="5" />
      <rect x="2" y="26" width="996" height="7" fill={MAGENTA} />
      <rect x="2" y="176" width="996" height="58" fill={MAGENTA} />
      {/* windows: light grey frames, dark glass, grilles */}
      {WINDOWS.map(x => (
        <g key={x}>
          <rect x={x - 4} y={48} width={WIN_W + 8} height={96} rx="8" fill="#c4c8cc" stroke="#1a0f0a" strokeWidth="3" />
          <rect x={x} y={52} width={WIN_W} height={88} rx="5" fill="#262b31" />
          {[1, 2, 3, 4, 5].map(i => (
            <line key={i} x1={x + i * 11.7} x2={x + i * 11.7} y1={54} y2={138} stroke="#9ca3af" strokeWidth="3" />
          ))}
        </g>
      ))}
      {/* magenta door surrounds around the open gaps, with grab poles */}
      {DOORS.map(x => (
        <g key={x}>
          <rect x={x - 12} y={34} width={DOOR_W + 24} height={216} fill={MAGENTA} stroke="#1a0f0a" strokeWidth="3" />
          <rect x={x} y={40} width={DOOR_W} height={208} fill="#1f1512" stroke="#1a0f0a" strokeWidth="4" />
          <line x1={x + DOOR_W / 2} x2={x + DOOR_W / 2} y1={44} y2={244} stroke="#d4d4d4" strokeWidth="5" />
        </g>
      ))}
      {/* round railway emblem badges on the band */}
      {(virarFast ? [60, 950] : [60, 700, 950]).map(cx => (
        <g key={cx}>
          <circle cx={cx} cy={205} r={17} fill="#f3f1ee" stroke="#1a0f0a" strokeWidth="2.5" />
          <circle cx={cx} cy={205} r={11} fill="#facc15" stroke="#1d4ed8" strokeWidth="3" />
          <circle cx={cx} cy={205} r={4} fill="#1d4ed8" />
        </g>
      ))}
      {/* coach number plate with a small Ethereum diamond */}
      <g transform="translate(250 188)">
        <rect width="170" height="40" rx="5" fill="#111" stroke="#f3f1ee" strokeWidth="3" />
        <path d="M18 6 L30 20 L18 27 L6 20 Z M18 29 L30 22 L18 36 L6 22 Z" fill="#a5b4fc" />
        <text x="40" y="29" fontSize="24" fontWeight="800" fill="#fff" fontFamily="var(--font-baloo), sans-serif">
          WR 8008 A
        </text>
      </g>
      {virarFast ? (
        <text x="560" y="214" fontSize="22" fontWeight="800" fill="#fff" fontFamily="var(--font-baloo), sans-serif">
          8.15 VIRAR FAST
        </text>
      ) : (
        <text
          x="575"
          y="226"
          fontSize="54"
          fontWeight="800"
          fill="#fff"
          letterSpacing="4"
          fontFamily="var(--font-baloo), sans-serif"
        >
          WR
        </text>
      )}
      {/* undercarriage */}
      <rect x="40" y="248" width="920" height="10" fill="#3a3d42" />
      {[90, 190, 810, 910].map(cx => (
        <circle key={cx} cx={cx} cy={256} r={16} fill="#3a3a3a" stroke="#111" strokeWidth="4" />
      ))}
    </svg>
  );
});

const OBSTACLES = ["ARM!", "BAG!", "DUPATTA!", "TIFFIN!"];

type CoachProps = {
  trainId: bigint | null;
  riders: Rider[];
  capacity: number;
  virarFast: boolean;
  latestSeats: Set<number>;
  hanger: (DoorHanger & { falling: boolean }) | null;
  closing: boolean;
  flyers: Set<number> | null; // seats flying off at Mahim, while leaving
};

export const Coach = ({ trainId, riders, capacity, virarFast, latestSeats, hanger, closing, flyers }: CoachProps) => {
  const fill = capacity > 0 ? riders.length / capacity : 0;
  const scale = 1.08 - 0.28 * Math.min(fill, 1);
  const hangerSlot = { x: DOORS[2] + DOOR_W + 26, y: 176 }; // off the last door, below the windows
  return (
    <div className="relative h-full w-full">
      <CoachBody virarFast={virarFast} />
      {closing &&
        DOORS.map(x => (
          <div
            key={x}
            className="absolute overflow-hidden"
            style={{ ...pct(x, 40), width: "8%", height: `${(208 / VB_H) * 100}%` }}
          >
            <div className="rush-door-left absolute inset-y-0 left-0 w-1/2 border-r-[0.3cqh] border-[#1a0f0a] bg-[#a8175f]">
              <div className="absolute left-[30%] top-[8%] h-[38%] w-[40%] rounded-[0.4cqh] bg-[#262b31]" />
            </div>
            <div className="rush-door-right absolute inset-y-0 right-0 w-1/2 border-l-[0.3cqh] border-[#1a0f0a] bg-[#a8175f]">
              <div className="absolute left-[30%] top-[8%] h-[38%] w-[40%] rounded-[0.4cqh] bg-[#262b31]" />
            </div>
          </div>
        ))}
      {riders.slice(0, SLOTS.length).map((r, i) => {
        const slot = SLOTS[i];
        const flying = flyers?.has(r.seat);
        const pokeUp = !slot.hangOut && slot.y < 90 && fill > 0.7 ? -8 : 0;
        return (
          <Figure
            key={`${trainId}-${r.seat}`}
            name={r.name}
            scale={scale}
            latest={latestSeats.has(r.seat)}
            teamwork={r.teamwork}
            hangOut={slot.hangOut}
            className={flying ? "rush-flyoff" : latestSeats.has(r.seat) ? "rush-pop" : ""}
            style={{ ...pct(slot.x, slot.y + pokeUp), zIndex: flying ? 50 : r.seat }}
          />
        );
      })}
      {closing &&
        DOORS.map((x, i) => (
          <div
            key={x}
            className="rush-stuck absolute z-40 whitespace-nowrap rounded-[0.8cqh] border-[0.35cqh] border-[#1a0f0a] bg-[#ffd200] px-[1cqh] font-display text-[2.8cqh] font-extrabold text-[#1a0f0a]"
            style={pct(x + DOOR_W / 2, 230)}
          >
            {OBSTACLES[(i + Number((trainId ?? 0n) % 4n)) % OBSTACLES.length]}
          </div>
        ))}
      {hanger && (
        <Figure
          key={hanger.address}
          name={hanger.name}
          scale={1.05}
          hangOut
          className={hanger.falling ? "rush-fall" : "rush-swing"}
          tagClassName="-mt-[0.6cqh] max-w-[16cqh] truncate rounded-[0.6cqh] border-[0.35cqh] border-[#1a0f0a] bg-[#ef4444] px-[0.8cqh] font-display text-[2.8cqh] font-extrabold leading-[1.25] text-white"
          style={{ ...pct(hangerSlot.x, hangerSlot.y), zIndex: 60 }}
        />
      )}
      {virarFast && (
        <div
          className="absolute z-30 rounded-[0.8cqh] border-[0.6cqh] border-[#dc2626] bg-white/90 px-[1.4cqh] font-display text-[4.2cqh] font-extrabold leading-tight tracking-wider text-[#dc2626]"
          style={{ ...pct(130, 4), transform: "translate(-50%, -50%) rotate(-8deg)" }}
        >
          SPECIAL
        </div>
      )}
    </div>
  );
};
