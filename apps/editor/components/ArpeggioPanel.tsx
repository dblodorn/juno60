"use client";

// ARPEGGIO, first on the panel as on the Juno-60: ON, MODE (UP, U&D, DOWN), RANGE (1, 2, 3 octaves), RATE, and HOLD.
// The settings are kept beside the patch (never in its 42 bytes) and saved with it; HOLD is a performance switch,
// never saved.

import { Button, Leader } from "@dblodorn/sound-ui";
import * as V from "../lib/juno60/codec";
import Info from "./Info";
import { H2, NOTE, Param, ParamSlider } from "./params";

const MODES: readonly { mode: V.ArpeggioMode; label: string }[] = [
  { mode: "UP", label: "UP" },
  { mode: "UP_DOWN", label: "U&D" },
  { mode: "DOWN", label: "DOWN" },
];
const PRESSED = "aria-pressed:bg-foreground aria-pressed:text-background";

interface Props {
  arpeggio: V.Arpeggio;
  onChange: (changes: Partial<Omit<V.Arpeggio, "version">>) => void;
  hold: boolean;
  onHold: () => void;
}

export default function ArpeggioPanel({ arpeggio: a, onChange, hold, onHold }: Props) {
  const state = a.on ? `${MODES.find(m => m.mode === a.mode)!.label} · ${a.range} OCT` : "OFF";
  return (
    <section aria-label="ARPEGGIO" className="grid content-start gap-3.5 border border-foreground p-3">
      <div className="flex items-baseline gap-2"><h2 className={H2}>ARPEGGIO</h2><Info k="arpeggio" /><Leader /><span>{state}</span></div>
      <div className="flex flex-wrap gap-1.5">
        <Button aria-pressed={a.on} className={PRESSED} onClick={() => onChange({ on: !a.on })}>ON</Button>
        <Button aria-pressed={hold} className={PRESSED} onClick={onHold}>HOLD</Button>
      </div>
      <div role="group" aria-label="MODE" className="flex gap-1.5">
        {MODES.map(m => (
          <Button key={m.mode} aria-pressed={a.mode === m.mode} className={PRESSED} onClick={() => onChange({ mode: m.mode })}>{m.label}</Button>
        ))}
      </div>
      <div role="group" aria-label="RANGE" className="flex items-center gap-1.5">
        {V.ARPEGGIO_RANGES.map(r => (
          <Button key={r} aria-pressed={a.range === r} className={PRESSED} onClick={() => onChange({ range: r })}>{r}</Button>
        ))}
        <span className="text-[10px] tracking-[.08em]">OCT</span>
      </div>
      <Param id="p-arp-rate" label="RATE" value={`${V.arpeggioRateDisplay(a.rate)} (${a.rate})`}>
        <ParamSlider id="p-arp-rate" value={a.rate} onChange={v => onChange({ rate: v })} min={0} max={V.SLIDER_MAX} step={1} />
      </Param>
      <p className={NOTE}>Saved with the patch, beside its sound. HOLD isn&apos;t saved.</p>
    </section>
  );
}
