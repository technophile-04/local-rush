import { type ReactNode, useEffect, useState } from "react";

// Random platform gags on timers. They are pointer-events-none overlays. They stay out of the
// headline band (18.5–27cqh) and off the coach body: walkers keep to the platform edge with their
// bubble beside them, and chatter sits on the roof only while no caption or banner is showing.

type Gag = "vendor" | "tc" | "chappal" | "late";
const GAGS: Gag[] = ["vendor", "tc", "chappal", "late"];
const GAG_MS: Record<Gag, number> = { vendor: 13000, tc: 12000, chappal: 3400, late: 9000 };

const CHATTER = ["Aage chalo!", "Move inside, there's space!", "Thoda adjust karo", "Bag in front, please"];

const Bubble = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div
    className={`relative whitespace-nowrap rounded-[1.4cqh] border-[0.4cqh] border-[#1a0f0a] bg-white px-[1.4cqh] py-[0.3cqh] font-display text-[3cqh] font-extrabold leading-tight text-[#1a0f0a] shadow-[0_0.5cqh_0_#1a0f0a] ${className}`}
  >
    {children}
  </div>
);

const Walker = ({ body, hat, children }: { body: string; hat?: ReactNode; children?: ReactNode }) => (
  <div className="flex items-end gap-[1cqh]">
    <div className="rush-step flex origin-bottom scale-[0.85] flex-col items-center">
      {hat}
      <div className="h-[4.4cqh] w-[4.4cqh] rounded-full border-[0.35cqh] border-[#1a0f0a] bg-[#a0663a]" />
      <div
        className="-mt-[0.4cqh] h-[5.4cqh] w-[5.6cqh] rounded-t-[2cqh] border-[0.35cqh] border-[#1a0f0a]"
        style={{ background: body }}
      />
    </div>
    {children}
  </div>
);

type CameosProps = { paused: boolean; quiet: boolean; chatterAnchors: number };

export const Cameos = ({ paused, quiet, chatterAnchors }: CameosProps) => {
  const [gag, setGag] = useState<{ kind: Gag; id: number } | null>(null);
  const [chatter, setChatter] = useState<{ text: string; door: number; id: number } | null>(null);

  useEffect(() => {
    if (paused) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = (delay: number) => {
      timer = setTimeout(() => {
        const kind = GAGS[Math.floor(Math.random() * GAGS.length)];
        setGag({ kind, id: Date.now() });
        timer = setTimeout(() => {
          setGag(null);
          schedule(6000 + Math.random() * 9000);
        }, GAG_MS[kind]);
      }, delay);
    };
    schedule(4000);
    return () => {
      clearTimeout(timer);
      setGag(null);
    };
  }, [paused]);

  useEffect(() => {
    if (paused || chatterAnchors < 3) return;
    const id = setInterval(() => {
      setChatter({
        text: CHATTER[Math.floor(Math.random() * CHATTER.length)],
        door: Math.floor(Math.random() * 3),
        id: Date.now(),
      });
      setTimeout(() => setChatter(null), 3500);
    }, 7000);
    return () => clearInterval(id);
  }, [paused, chatterAnchors]);

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {chatter && !quiet && (
        <div
          key={chatter.id}
          className="rush-caption absolute"
          style={{ left: `${[18, 46, 80][chatter.door]}cqh`, top: "27.5cqh", ["--d" as string]: "3.5s" }}
        >
          <Bubble>{chatter.text}</Bubble>
        </div>
      )}
      {gag?.kind === "vendor" && (
        <div
          key={gag.id}
          className="absolute bottom-[24cqh] left-0"
          style={{ animation: "rush-walk 13s linear forwards" }}
        >
          <Walker
            body="#16a34a"
            hat={
              <div className="mb-[-0.6cqh] h-[2cqh] w-[8cqh] rounded-t-full border-[0.35cqh] border-[#1a0f0a] bg-[#b45309]" />
            }
          >
            <Bubble>Chikki! Vada pav! Hairclip, earring!</Bubble>
          </Walker>
        </div>
      )}
      {gag?.kind === "tc" && (
        <>
          <div
            key={gag.id}
            className="absolute bottom-[24cqh] left-0"
            style={{ animation: "rush-walk-back 12s linear forwards" }}
          >
            <Walker
              body="#111827"
              hat={<div className="mb-[-0.5cqh] h-[1.6cqh] w-[5cqh] rounded-t-[1cqh] bg-[#111827]" />}
            >
              <Bubble>Ticket dikhao!</Bubble>
            </Walker>
          </div>
          <div
            className="rush-caption absolute left-[96cqh] top-[70.5cqh]"
            style={{ animationDelay: "3s", ["--d" as string]: "5s" }}
          >
            <Bubble className="bg-[#ffd200]">NFT hai bhai.</Bubble>
          </div>
        </>
      )}
      {gag?.kind === "chappal" && (
        <div key={gag.id} className="rush-chappal absolute left-0 top-[20cqh]">
          <div className="h-[2.6cqh] w-[7cqh] rounded-full border-[0.35cqh] border-[#1a0f0a] bg-[#2563eb]">
            <div className="ml-[2cqh] mt-[-0.8cqh] h-[1.6cqh] w-[2.6cqh] rounded-t-full border-[0.35cqh] border-b-0 border-[#1a0f0a]" />
          </div>
        </div>
      )}
      {gag?.kind === "late" && !quiet && (
        <div key={gag.id} className="rush-drop-in absolute right-[2cqh] top-[18.5cqh] w-[40cqh]">
          <div className="rounded-[0.6cqh] border-[0.5cqh] border-[#1a0f0a] bg-white px-[1.4cqh] py-[0.8cqh] font-display text-[2.6cqh] font-extrabold leading-tight text-[#b91c1c] shadow-[0_1cqh_2cqh_rgba(0,0,0,0.4)]">
            Due to technical reasons trains are running 10–15 minutes late. Inconvenience is regretted.
          </div>
        </div>
      )}
    </div>
  );
};
