import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

/** Always-visible QR to the phone page; keeps `?mock=1` so rehearsals share the mock world. */
export const JoinCorner = ({ mock }: { mock: boolean }) => {
  const [url, setUrl] = useState("");
  useEffect(() => setUrl(`${window.location.origin}/${mock ? "?mock=1" : ""}`), [mock]);
  return (
    <div className="flex h-full items-center gap-[1.6cqh] rounded-[1.2cqh] border-[0.5cqh] border-[#1a0f0a] bg-[#ffd200] p-[1cqh] shadow-[0_1cqh_2cqh_rgba(0,0,0,0.45)]">
      <div className="aspect-square h-full shrink-0 rounded-[0.6cqh] bg-white p-[0.8cqh]">
        {url && <QRCodeSVG value={url} size={256} level="M" className="h-full w-full" />}
      </div>
      <div className="flex min-w-0 flex-col gap-[0.8cqh] font-display text-[#1a0f0a]">
        <span className="text-[4.6cqh] font-extrabold leading-[0.95]">
          Scan karo,
          <br />
          chadho!
        </span>
        <span className="[overflow-wrap:anywhere] text-[2.5cqh] font-bold leading-tight">
          {url.replace(/^https?:\/\//, "")}
        </span>
      </div>
    </div>
  );
};
