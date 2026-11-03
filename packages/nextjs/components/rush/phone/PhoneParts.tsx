import { useState } from "react";
import { countdown, crowdLevel, hasDeparted, rushErrorText } from "../rush";
import { LedText } from "../screen/Boards";
import { PaperTicket } from "./PaperTicket";
import { Address, AddressInput } from "@scaffold-ui/components";
import { isAddress } from "viem";
import { base } from "viem/chains";
import type { LoginMethod, RushActions, RushSession, Ticket, TrainView } from "~~/types/rush";

export const MiniBoard = ({ train, now }: { train: TrainView | null; now: number }) => {
  if (!train) {
    return (
      <div className="rounded-xl border-4 border-[#2a2a2a] bg-black px-4 py-3 font-led text-2xl font-black text-[#ffb000]">
        Train arriving…
      </div>
    );
  }
  const departed = hasDeparted(train, now);
  const level = crowdLevel(train.riders.length, train.capacity);
  const time = departed ? "departed" : train.departsAt ? countdown(train.departsAt - now) : "-:--";
  return (
    <div className="rounded-xl border-4 border-[#2a2a2a] bg-black px-4 py-3 shadow-lg">
      <div
        className={`font-led text-[1.6rem] font-black leading-tight ${train.virarFast ? "rush-flash-red" : "text-[#ffb000]"}`}
      >
        <LedText
          text={`Train #${String(train.trainId)} → ${train.virarFast ? "8.15 VIRAR FAST" : train.destination}`}
        />
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 font-led text-[1.4rem] font-black text-[#ffb000]">
        <span>
          <LedText text={time} /> · {train.riders.length}/{train.capacity}
        </span>
        <span
          className="rounded-md px-2 font-display text-sm font-extrabold leading-6 text-[#1d1f23]"
          style={{ background: level.color }}
        >
          {level.phone}
        </span>
      </div>
    </div>
  );
};

const METHODS: { method: LoginMethod; label: string; hint: string }[] = [
  { method: "passkey", label: "Passkey login", hint: "Face / fingerprint. Ticket stays with you." },
  { method: "burner", label: "Quick ticket (no login)", hint: "Fastest. Lives in this browser." },
  { method: "wallet", label: "Connect wallet", hint: "MetaMask, Rainbow, Coinbase…" },
];

const METHOD_NAMES: Record<LoginMethod, string> = { passkey: "Passkey", burner: "Quick ticket", wallet: "Wallet" };

export const LoginPanel = ({ session }: { session: RushSession }) => {
  const [error, setError] = useState<string>();
  if (session.status === "ready") {
    return (
      <div className="rush-riding flex items-center gap-3 rounded-2xl border-2 border-[#ffd200]/30 bg-[#85114b]/80 px-3 py-2.5 text-white">
        {session.address && isAddress(session.address) ? (
          <div className="rush-sui rush-sui-chip min-w-0 flex-1">
            <div className="rush-riding-label">Riding as</div>
            <Address address={session.address} chain={base} size="xl" />
          </div>
        ) : (
          <div className="flex-1 font-display text-lg font-extrabold">Logged in</div>
        )}
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {session.method && <span className="rush-riding-tag">{METHOD_NAMES[session.method]}</span>}
          <button className="btn btn-ghost btn-xs h-6 min-h-6 px-1 text-white/70" onClick={session.logout}>
            logout
          </button>
        </div>
      </div>
    );
  }
  const connecting = session.status === "connecting";
  return (
    <div className="flex flex-col gap-2">
      {METHODS.map(({ method, label, hint }) => (
        <button
          key={method}
          disabled={connecting}
          className="btn btn-lg h-auto min-h-16 flex-col items-start gap-0 border-4 border-[#1d1f23] bg-[#ffd200] py-2 text-left text-[#1d1f23] hover:bg-[#ffe14d] disabled:bg-[#ffd200]/60"
          onClick={async () => {
            setError(undefined);
            try {
              await session.login(method);
            } catch (e) {
              setError(rushErrorText(e, "Couldn't log in, try again"));
            }
          }}
        >
          <span className="font-display text-xl font-extrabold">
            {connecting && session.method === method && <span className="loading loading-spinner loading-sm mr-2" />}
            {label}
          </span>
          <span className="text-xs font-semibold opacity-75">{hint}</span>
        </button>
      ))}
      {error && <div className="text-center font-bold text-[#ffb4a8]">{error}</div>}
    </div>
  );
};

const CONFETTI_COLORS = ["#ffd200", "#ef4444", "#22c55e", "#3b82f6", "#f97316", "#ec4899"];

// Deterministic scatter so render stays pure.
const jitter = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
const CONFETTI = Array.from({ length: 28 }, (_, i) => ({
  dx: `${(jitter(i, 1) - 0.5) * 340}px`,
  dy: `${-60 - jitter(i, 2) * 220}px`,
  r: `${jitter(i, 3) * 720 - 360}deg`,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
}));

export const Confetti = () => {
  const pieces = CONFETTI;
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="rush-confetti absolute h-3 w-2 rounded-sm"
          style={{ background: p.color, ["--dx" as string]: p.dx, ["--dy" as string]: p.dy, ["--r" as string]: p.r }}
        />
      ))}
    </div>
  );
};

const TicketCard = ({ ticket, actions }: { ticket: Ticket; actions: RushActions }) => {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  // Only known in this session: tickets don't record who they were sent to.
  const [sentTo, setSentTo] = useState<string>();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const [showArt, setShowArt] = useState(false);
  return (
    <div className="flex flex-col">
      {showArt && ticket.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={ticket.image}
          alt={`Ticket #${ticket.tokenId}`}
          className="w-full rounded-lg border-4 border-[#1d1f23] shadow-[0_6px_0_#1d1f23]"
        />
      ) : (
        <PaperTicket ticket={ticket} sent={!ticket.held} />
      )}
      <div className="rush-stub">
        {ticket.image && (
          <button className="rush-stub-link" onClick={() => setShowArt(!showArt)}>
            {showArt ? "← paper ticket" : "view onchain art →"}
          </button>
        )}
        {!ticket.held ? (
          <div className="flex flex-wrap items-center gap-x-2 text-base font-bold">
            {sentTo && isAddress(sentTo) ? (
              <>
                Sent to
                <span className="rush-sui rush-sui-ticket">
                  <Address address={sentTo} chain={base} size="sm" onlyEnsOrAddress />
                </span>
                ✓
              </>
            ) : (
              "Sent ✓"
            )}
          </div>
        ) : !open ? (
          <button className="btn btn-sm rush-stub-btn" onClick={() => setOpen(true)}>
            Send to my wallet
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="rush-sui rush-sui-ticket rush-sui-send">
              <AddressInput value={to} onChange={setTo} placeholder="ENS name or 0x address" disabled={sending} />
            </div>
            <div className="flex gap-2">
              <button
                className="btn btn-sm rush-stub-btn rush-stub-btn-go flex-1"
                // AddressInput reports the typed ENS name first and the resolved 0x address after lookup.
                disabled={!isAddress(to) || sending}
                onClick={async () => {
                  setSending(true);
                  setError(undefined);
                  try {
                    await actions.sendTicket(ticket.tokenId, to);
                    setSentTo(to);
                    setOpen(false);
                  } catch (e) {
                    setError(rushErrorText(e, "Couldn't send, try again"));
                  } finally {
                    setSending(false);
                  }
                }}
              >
                {sending ? <span className="loading loading-spinner loading-xs" /> : "Send"}
              </button>
              <button className="btn btn-sm btn-ghost" onClick={() => setOpen(false)} disabled={sending}>
                Cancel
              </button>
            </div>
            {error && <div className="text-sm font-bold text-red-700">{error}</div>}
          </div>
        )}
      </div>
    </div>
  );
};

export const MyTickets = ({ actions }: { actions: RushActions }) => {
  if (actions.tickets.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="m-0 font-display text-2xl font-extrabold text-white">My tickets</h2>
      {actions.tickets.map(t => (
        <TicketCard key={String(t.tokenId)} ticket={t} actions={actions} />
      ))}
    </section>
  );
};
