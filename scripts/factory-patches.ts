#!/usr/bin/env node
// Builds factory/roland-juno60-factory.json, Roland's 56 factory patches in the editor's .json patch format, from
// the factory patch sheet that Andy Harman transcribed for JunoX (patches/Juno60.csv in
// github.com/pendragon-andyh/junox; credited in LIBRARY → COLOPHON). Only the sheet's values are used, no code.
//   node scripts/factory-patches.ts <Juno60.csv>
// Sliders are panel readings 0–10 (stored as round(v × 12.7)); VCA LEVEL is −5…+5; letters are the sheet's
// switch positions. Names longer than the editor's 16 characters are shortened by hand below.
import { readFileSync, writeFileSync } from "node:fs";

const SHORT: Record<string, string> = {
  "Pizzicato Sound 1": "PIZZICATO SND 1",
  "Pizzicato Sound 2": "PIZZICATO SND 2",
  "Phase Combination": "PHASE COMBINATN",
  "Synthesizer Organ": "SYNTH ORGAN",
  "Mysterious Invention": "MYSTERIOUS INVNT",
  "Percussive Sound 1": "PERCUSSIVE SND 1",
  "Percussive Sound 2": "PERCUSSIVE SND 2",
};

const csv = readFileSync(process.argv[2] ?? "Juno60.csv", "utf8").trim().split(/\r?\n/);
const head = csv[0]!.split(",");
const rows = csv.slice(1).map(l => Object.fromEntries(l.split(",").map((v, i) => [head[i]!, v.trim()])) as Record<string, string>);

const slider = (v: string): number => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 10) throw new Error(`slider value ${v}`);
  return Math.round(n * 12.7);
};
const pick = (v: string, map: Record<string, number>, what: string): number => {
  const n = map[v];
  if (n === undefined) throw new Error(`${what}: ${v}`);
  return n;
};
const bit = (v: string): number => pick(v, { "0": 0, "1": 1 }, "switch");

const patches = rows.filter(r => /^\d+$/.test(r["Number"] ?? "")).map(r => {
  const name = SHORT[r["Name"]!] ?? r["Name"]!.toUpperCase();
  if (name.length > 16) throw new Error(`name too long: ${name}`);
  return {
    name,
    number: Number(r["Number"]),
    values: {
      lfoRate: slider(r["LFO Rate"]!), lfoDelay: slider(r["LFO Delay"]!),
      dcoLfo: slider(r["DCO Lfo"]!), dcoPwm: slider(r["DCO PWM"]!), dcoSub: slider(r["DCO Sub"]!), dcoNoise: slider(r["DCO Noise"]!),
      vcfFreq: slider(r["VCF Freq"]!), vcfRes: slider(r["VCF Res"]!), vcfEnv: slider(r["VCF Env"]!), vcfLfo: slider(r["VCF LFO"]!),
      vcfKybd: slider(r["VCF Key"]!), vcaLevel: slider(String(Number(r["VCA Value"]) + 5)),
      envA: slider(r["ENV Attack"]!), envD: slider(r["ENV Decay"]!), envS: slider(r["ENV Sustain"]!), envR: slider(r["ENV Release"]!),
      hpf: pick(r["HPF"]!, { "0": 0, "1": 1, "2": 2, "3": 3 }, "HPF"),
      range: pick(r["Range"]!, { D: 0, N: 1, U: 2 }, "range"), // 16', 8', 4'
      pulse: bit(r["DCO Pulse"]!), saw: bit(r["DCO Saw"]!), sub: bit(r["DCO Sub Enabled"]!),
      pwmMode: pick(r["DCO Lfo Mod"]!, { E: 0, M: 1, L: 2 }, "PWM mode"),
      vcfPolarity: pick(r["VCF Dir"]!, { N: 0, I: 1 }, "ENV polarity"),
      vcaMode: pick(r["VCA Dir"]!, { E: 0, G: 1 }, "VCA mode"),
      chorus: pick(r["Chorus"]!, { "0": 0, "1": 1, "2": 2, "3": 3 }, "chorus"),
      lfoTrigger: pick(r["LFO Trigger"]!, { A: 0, M: 1 }, "LFO trigger"),
    },
  };
});
if (patches.length !== 56) throw new Error(`expected 56 patches, got ${patches.length}`);

const file = {
  format: "dmbk-juno60-patches",
  version: 1,
  source: "Roland's Juno-60 factory patches (patch numbers 11–78), from the factory patch sheet transcribed by Andy Harman for JunoX (github.com/pendragon-andyh/junox).",
  patches: patches.map(({ name, number, values }) => ({ name, number, values })),
};
writeFileSync("factory/roland-juno60-factory.json", JSON.stringify(file, null, 2) + "\n");
console.log(`wrote ${patches.length} patches to factory/roland-juno60-factory.json`);
