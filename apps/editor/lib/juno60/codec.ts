// The write side, re-exporting the read side from the engine package. Bytes are the source of truth: every edit goes
// through set() and touches only that field's byte; a patch is never rebuilt from values.

import { NAME_BYTE, NAME_LENGTH, VOICE_BYTES, VOICE_FIELDS, voiceField } from "@dblodorn/roland-juno60-engine";

export * from "@dblodorn/roland-juno60-engine";

// a copy with one field changed, clamped to its range
export function set(patch: Uint8Array, key: string, value: number): Uint8Array {
  return setMany(patch, { [key]: value });
}

export function setMany(patch: Uint8Array, values: Record<string, number>): Uint8Array {
  const out = new Uint8Array(patch);
  for (const [key, v] of Object.entries(values)) {
    const f = voiceField(key);
    out[f.byte] = Math.max(f.min, Math.min(f.max, Math.round(v)));
  }
  return out;
}

// printable ASCII, upper case as the other editors show names, padded with spaces
export function setName(patch: Uint8Array, name: string): Uint8Array {
  const out = new Uint8Array(patch);
  const clean = name.toUpperCase().replace(/[^\x20-\x7e]/g, " ").slice(0, NAME_LENGTH);
  for (let i = 0; i < NAME_LENGTH; i++) out[NAME_BYTE + i] = i < clean.length ? clean.charCodeAt(i) : 0x20;
  return out;
}

// INIT: this editor's starting point (the Juno-60 has no init patch of its own): a saw at 8', the filter open, no
// modulation, the envelope as an organ (full sustain, short release), the chorus off.
export const INIT_VALUES: Readonly<Record<string, number>> = {
  lfoRate: 64, lfoDelay: 0, dcoLfo: 0, dcoPwm: 0, dcoSub: 0, dcoNoise: 0,
  vcfFreq: 127, vcfRes: 0, vcfEnv: 0, vcfLfo: 0, vcfKybd: 0, vcaLevel: 64,
  envA: 0, envD: 0, envS: 127, envR: 25,
  hpf: 0, range: 1, pulse: 0, saw: 1, sub: 0, pwmMode: 1, vcfPolarity: 0, vcaMode: 0, chorus: 0, lfoTrigger: 0,
};

export function initVoice(name = "INIT"): Uint8Array {
  return setName(setMany(new Uint8Array(VOICE_BYTES), INIT_VALUES), name);
}

// ---------- .json files ----------
// The Juno-60 saves to cassette, which this editor doesn't read yet, so patches travel as JSON: readable named panel
// values (what a player would note down from the panel), one or many patches per file.

export const FILE_FORMAT = "dmbk-juno60-patches";

export interface PatchFile { format: typeof FILE_FORMAT; version: 1; patches: { name: string; values: Record<string, number> }[] }

export function toFile(patches: Uint8Array[]): string {
  const file: PatchFile = {
    format: FILE_FORMAT,
    version: 1,
    patches: patches.map(p => ({
      name: nameOf(p),
      values: Object.fromEntries(VOICE_FIELDS.map(f => [f.key, p[f.byte]!])),
    })),
  };
  return JSON.stringify(file, null, 2) + "\n";
}

const nameOf = (p: Uint8Array): string => String.fromCharCode(...p.subarray(NAME_BYTE, NAME_BYTE + NAME_LENGTH)).trimEnd();

// Patches from a file's text; throws with a reason a player can act on. Missing values take INIT's; values out of
// range are refused.
export function fromFile(text: string): Uint8Array[] {
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new Error("NOT A JSON FILE."); }
  const f = data as Partial<PatchFile>;
  if (!f || f.format !== FILE_FORMAT) throw new Error("NOT A JUNO-60 PATCH FILE FROM THIS EDITOR.");
  if (f.version !== 1) throw new Error(`PATCH FILE VERSION ${String(f.version)} ISN'T READ BY THIS EDITOR.`);
  if (!Array.isArray(f.patches) || !f.patches.length) throw new Error("THE FILE HAS NO PATCHES.");
  return f.patches.map((p, i) => {
    const values = p && typeof p.values === "object" && p.values ? p.values : {};
    for (const [k, v] of Object.entries(values)) {
      const field = VOICE_FIELDS.find(x => x.key === k);
      if (!field) continue; // a later version's extra field
      if (!Number.isInteger(v) || v < field.min || v > field.max) throw new Error(`PATCH ${i + 1}: ${field.section} ${field.label} IS ${String(v)}, OUTSIDE ${field.min}–${field.max}.`);
    }
    const known = Object.fromEntries(Object.entries(values).filter(([k]) => VOICE_FIELDS.some(x => x.key === k)));
    return setName(setMany(initVoice(), known), typeof p.name === "string" ? p.name : "UNTITLED");
  });
}
