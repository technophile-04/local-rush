import { type CSSProperties, type ReactNode, useState } from "react";
import type { Ticket } from "~~/types/rush";

// mulberry32: a stable little PRNG so each ticket keeps the same tilt, creases and stamp spots across renders.
const seeded = (tokenId: bigint) => {
  let a = Number(tokenId % 4294967296n) ^ 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const between = (rand: () => number, min: number, max: number) => min + rand() * (max - min);
const pad = (value: number | bigint, length: number) => String(value).padStart(length, "0");

type Stamp = { text: string; sub?: string; ink: "red" | "blue" | "violet" };

const stampsFor = (ticket: Ticket): Stamp[] => [
  ...(ticket.virarFast ? [{ text: "8:15 VIRAR FAST", sub: "RARE TRAIN", ink: "violet" as const }] : []),
  ...(ticket.teamwork ? [{ text: "TEAMWORK PUSH", sub: "2 PAX · 1 DOOR", ink: "blue" as const }] : []),
  ...(ticket.mahim ? [{ text: "BHAI, MAHIM NAHI!", ink: "red" as const }] : []),
];

const Line = ({ label, value, wide }: { label: string; value: ReactNode; wide?: boolean }) => (
  <div className={wide ? "col-span-2" : undefined}>
    <span className="rush-paper-label">{label}:</span> {value}
  </div>
);

/** A Mumbai suburban UTS journey ticket, printed from the ticket NFT's traits. */
export const PaperTicket = ({ ticket, sent }: { ticket: Ticket; sent: boolean }) => {
  // The ticket doesn't record when it was bought, so it carries the time it was first shown here.
  const [printedAt] = useState(() => new Date());
  const rand = seeded(ticket.tokenId);
  const tilt = between(rand, -2.2, 2.2);
  const style = {
    "--tilt": `${tilt}deg`,
    "--crease-a": `${between(rand, 28, 46)}%`,
    "--crease-b": `${between(rand, 58, 78)}%`,
    "--crease-angle": `${between(rand, 84, 96)}deg`,
    "--ear": `${between(rand, 14, 24)}px`,
    "--ink-fade": between(rand, 0.72, 0.9),
  } as CSSProperties;
  const stamps = stampsFor(ticket);
  const destination = ticket.virarFast ? "VIRAR" : (ticket.destination ?? "DEVCON PF 8");
  const from = destination === "CHURCHGATE" ? "VIRAR" : "CHURCHGATE";
  const date = `${pad(printedAt.getDate(), 2)}/${pad(printedAt.getMonth() + 1, 2)}/${printedAt.getFullYear()}`;
  const time = `${pad(printedAt.getHours(), 2)}:${pad(printedAt.getMinutes(), 2)}`;
  const utsNo = `RUSH${pad(ticket.tokenId, 6)}`;

  return (
    <div className="rush-paper" style={style}>
      <div className="rush-paper-print">
        <div className="flex items-baseline justify-between">
          <span>WESTERN RAILWAY</span>
          <span className="rush-paper-small">(M)</span>
        </div>
        <div className="rush-paper-title">JOURNEY TICKET</div>
        <div className="flex justify-between">
          <span>UTS No: {utsNo}</span>
          <span className="rush-paper-small">₹ PAID</span>
        </div>
        <div className="rush-paper-rule" />
        <div className="grid grid-cols-2 gap-x-3">
          <Line label="ADULT" value="01" />
          <Line label="CHILD" value="00" />
          <Line label="CLASS" value="II" />
          <Line label="TYPE" value={ticket.virarFast ? "FAST" : "ORDINARY"} />
          <Line label="TRAIN" value={`#${pad(ticket.trainId, 4)}`} />
          <Line label="SEAT" value={pad(ticket.seat, 2)} />
        </div>
        <div className="rush-paper-route">
          <div>FR: {from}</div>
          <div>TO: {destination}</div>
        </div>
        <div className="grid grid-cols-2 gap-x-3">
          <Line label="VIA" value="-" />
          <Line label="Rs" value="0.00/-" />
          {ticket.crowd && <Line wide label="CROWD" value={ticket.crowd.toUpperCase()} />}
        </div>
        <div className="flex justify-between">
          <span>{date}</span>
          <span>{time}</span>
        </div>
        <div className="rush-paper-rule" />
        <div className="rush-paper-small">
          Valid for travel by ordinary train within 1 hr.
          <br />
          Fare paid by paymaster. DEVCON · PF 8
        </div>
      </div>

      {stamps.map((stamp, index) => (
        <div
          key={stamp.text}
          className={`rush-stamp rush-stamp-${stamp.ink}`}
          style={{
            top: `${between(rand, 50, 56) + index * 17}%`,
            right: `${between(rand, 3, 10) + index * 6}%`,
            rotate: `${between(rand, -12, 8)}deg`,
          }}
        >
          {stamp.text}
          {stamp.sub && <span className="rush-stamp-sub">{stamp.sub}</span>}
        </div>
      ))}
      {sent && (
        <div className="rush-stamp rush-stamp-cancel" style={{ rotate: `${between(rand, -24, -12)}deg` }}>
          SENT TO WALLET
          <span className="rush-stamp-sub">{date}</span>
        </div>
      )}
    </div>
  );
};
