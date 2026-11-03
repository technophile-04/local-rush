import { useCallback, useMemo, useRef, useState } from "react";

// WebAudio-synthesised station sounds. Browsers only allow audio after a user gesture,
// so the screen shows a "Tap for sound" chip that calls enable().

const tone = (ctx: AudioContext, freq: number, start: number, dur: number, type: OscillatorType, gain: number) => {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + dur + 0.05);
  return osc;
};

export const useRushSound = () => {
  const ctxRef = useRef<AudioContext | null>(null);
  const [enabled, setEnabled] = useState(false);

  const enable = useCallback(() => {
    ctxRef.current ??= new AudioContext();
    void ctxRef.current.resume();
    setEnabled(true);
  }, []);

  const play = useCallback((fn: (ctx: AudioContext, t: number) => void) => {
    const ctx = ctxRef.current;
    if (ctx && ctx.state === "running") fn(ctx, ctx.currentTime);
  }, []);

  return useMemo(
    () => ({
      enabled,
      enable,
      // Two-tone announcement chime: "ting-tong".
      chime: () =>
        play((ctx, t) => {
          tone(ctx, 784, t, 0.9, "sine", 0.25);
          tone(ctx, 622, t + 0.45, 1.2, "sine", 0.25);
        }),
      // Electric horn: "PAAAM".
      horn: () =>
        play((ctx, t) => {
          [233, 294, 349].forEach(f => tone(ctx, f, t, 1.6, "sawtooth", 0.08));
        }),
      pop: () =>
        play((ctx, t) => {
          const osc = tone(ctx, 500, t, 0.18, "triangle", 0.2);
          osc.frequency.exponentialRampToValueAtTime(1100, t + 0.12);
        }),
    }),
    [enabled, enable, play],
  );
};
