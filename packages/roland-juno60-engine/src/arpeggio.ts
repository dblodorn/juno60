// The arpeggiator settings: a section of their own beside a patch, never inside its 42 sound bytes. The Juno-60
// itself never stored them (its arpeggiator is a live panel section); this project keeps them with a patch so an
// arpeggio belongs to a sound, in the editor, in patch files, in the dmbk library and in windchime alike. HOLD is a
// performance switch and isn't part of them. `readArpeggio` is the one check, as `readVoice` is for the bytes.

import { SLIDER_MAX, toPanel } from "./params.ts";

export const ARPEGGIO_MODES = ["UP", "DOWN", "UP_DOWN"] as const;
export type ArpeggioMode = (typeof ARPEGGIO_MODES)[number];
export const ARPEGGIO_RANGES = [1, 2, 3] as const;
export const ARPEGGIO_VERSION = 1;

export interface Arpeggio {
  readonly version: 1;
  readonly on: boolean;
  readonly mode: ArpeggioMode;
  readonly range: 1 | 2 | 3; // octaves
  readonly rate: number; // 0–127, read on the panel's 0–10 scale
}

// what a patch without arpeggiator settings plays with: the arpeggiator off
export const DEFAULT_ARPEGGIO: Arpeggio = Object.freeze({ version: 1, on: false, mode: "UP", range: 1, rate: 64 });

// RATE on the panel's 0–10 scale, like the other sliders
export const arpeggioRateDisplay = (rate: number): string => toPanel(rate).toFixed(1);

// A frozen copy of the settings after checking them; throws naming the field. Extra fields are refused too, so a
// later version's settings aren't half-read.
export function readArpeggio(x: unknown): Arpeggio {
  if (!x || typeof x !== "object" || Array.isArray(x)) throw new TypeError("Arpeggiator settings must be an object.");
  const o = x as Record<string, unknown>; // checked field by field below
  if (o.version !== ARPEGGIO_VERSION) throw new RangeError(`Arpeggiator settings: version must be ${ARPEGGIO_VERSION}, got ${String(o.version)}.`);
  if (typeof o.on !== "boolean") throw new TypeError(`Arpeggiator settings: on must be true or false, got ${String(o.on)}.`);
  if (!ARPEGGIO_MODES.includes(o.mode as ArpeggioMode)) throw new RangeError(`Arpeggiator settings: mode must be ${ARPEGGIO_MODES.join(", ")}, got ${String(o.mode)}.`);
  if (!ARPEGGIO_RANGES.includes(o.range as 1 | 2 | 3)) throw new RangeError(`Arpeggiator settings: range must be 1, 2 or 3, got ${String(o.range)}.`);
  if (!Number.isInteger(o.rate) || (o.rate as number) < 0 || (o.rate as number) > SLIDER_MAX) throw new RangeError(`Arpeggiator settings: rate must be a whole number from 0 to ${SLIDER_MAX}, got ${String(o.rate)}.`);
  const extra = Object.keys(o).find(k => !["version", "on", "mode", "range", "rate"].includes(k));
  if (extra) throw new RangeError(`Arpeggiator settings: unknown field ${extra}.`);
  return Object.freeze({ version: 1, on: o.on, mode: o.mode as ArpeggioMode, range: o.range as 1 | 2 | 3, rate: o.rate as number });
}
