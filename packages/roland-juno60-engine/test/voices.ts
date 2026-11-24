// Test-only patch builder: named panel values over a plain saw patch.

import { NAME_BYTE, NAME_LENGTH, VOICE_BYTES, voiceField } from "../src/params.ts";

export const BASE: Record<string, number> = {
  lfoRate: 0, lfoDelay: 0, dcoLfo: 0, dcoPwm: 0, dcoSub: 0, dcoNoise: 0,
  vcfFreq: 127, vcfRes: 0, vcfEnv: 0, vcfLfo: 0, vcfKybd: 0, vcaLevel: 64,
  envA: 0, envD: 0, envS: 127, envR: 20,
  hpf: 0, range: 1, pulse: 0, saw: 1, sub: 0, pwmMode: 1, vcfPolarity: 0, vcaMode: 0, chorus: 0, lfoTrigger: 0,
};

export function patch(values: Record<string, number> = {}, name = "TEST"): Uint8Array {
  const b = new Uint8Array(VOICE_BYTES);
  for (const [k, v] of Object.entries({ ...BASE, ...values })) b[voiceField(k).byte] = v;
  for (let i = 0; i < NAME_LENGTH; i++) b[NAME_BYTE + i] = i < name.length ? name.charCodeAt(i) : 0x20;
  return b;
}

// panel reading 0–10 → stored byte
export const slider = (s: number): number => Math.round((s * 127) / 10);
