// What changed, for /changelog. Newest first: add each shipped feature, fix or enhancement at the top, one short
// line about what a player sees, hears or can do. Spec work, agent notes and tooling get no entry.

export type ChangeKind = "FEATURE" | "ENHANCEMENT" | "FIX";
export interface Change { date: string; type: ChangeKind; text: string }

export const CHANGELOG: Change[] = [
  { date: "2026-11-24", type: "FEATURE", text: "ARPEGGIO: the Juno-60's arpeggiator (UP, U&D, DOWN over 1–3 octaves, RATE, HOLD), played from KEYS, the computer keys and MIDI IN. Its settings are saved with the patch, in LOCAL, SHARED and .json files, and windchime plays them." },
  { date: "2026-11-24", type: "FIX", text: "KEYS: black keys are key-sized instead of covering the page." },
  { date: "2026-11-24", type: "FEATURE", text: "LIBRARY → SHARED: share patches in a public list, open anyone's, and rename, update or delete your own, no account needed. Roland's 56 factory patches are in it." },
  { date: "2026-11-24", type: "FEATURE", text: "First release: edit a Juno-60 patch on its panel (LFO, DCO, HPF, VCF, VCA, ENV, CHORUS), hear it with an approximate emulator, play it with KEYS, the computer keys or MIDI IN, and keep patches in LIBRARY → LOCAL with .json import and export." },
];
