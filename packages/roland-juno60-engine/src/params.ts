// The one field table: every byte of a Juno-60 patch, in panel order (LFO, DCO, HPF, VCF, VCA, ENV, CHORUS), then
// the name. The Juno-60 stores 56 patches but publishes no data format (it has no MIDI; patches go to cassette), so
// this 42-byte layout is this project's own: one byte per panel control, sliders as 0–127 (the convention of the
// Juno-106's SysEx, the closest documented relative), switches as small integers, then a 16-character name.
// Sources (the owner's manual hasn't been read for this yet, so anything only it would settle is flagged):
// - Wikipedia's Roland Juno-60 article: 6 voices, 1 DCO + sub per voice, 24 dB/oct resonant VCF and a separate HPF,
//   one ADSR, one triangle LFO, chorus on two buttons that can both be on, 56 patches, DCB (no MIDI).
// - Andy Harman's Juno-60 analysis (MIT, github.com/pendragon-andyh/Juno60): HPF positions 0–3, the three chorus modes.
// - The factory patch sheet in JunoX (github.com/pendragon-andyh/junox): which controls a patch stores and their
//   panel readings (sliders 0–10, VCA LEVEL −5…+5, PWM mode E/L/M, ENV direction N/I, VCA E/G, LFO trigger A/M).
// - Roland's specification listing, as quoted by a search: "PWM Mode Switch (ENV / MANUAL / LFO)" (order unverified).
// Look fields up with voiceField(key), which throws on an unknown key.

export interface Field {
  key: string;
  byte: number;
  label: string;
  section: Section;
  min: number;
  max: number;
  options?: readonly string[];
  // the panel reading, for sliders (0–10 as printed beside them; VCA LEVEL is −5 to +5)
  display?: (v: number) => string;
}

export type Section = "LFO" | "DCO" | "HPF" | "VCF" | "VCA" | "ENV" | "CHORUS";
export const SECTIONS: readonly Section[] = ["LFO", "DCO", "HPF", "VCF", "VCA", "ENV", "CHORUS"];

export const SLIDER_MAX = 127;
// the panel's 0–10 scale
export const toPanel = (v: number): number => (v * 10) / SLIDER_MAX;
const panel = (v: number): string => toPanel(v).toFixed(1);
const centred = (v: number): string => { const x = toPanel(v) - 5; return `${x > 0.04 ? "+" : ""}${x.toFixed(1)}`; };

export const RANGES = ["16'", "8'", "4'"] as const;
export const PWM_MODES = ["ENV", "MAN", "LFO"] as const;
export const ENV_POLARITIES = ["NORMAL", "INVERTED"] as const;
export const VCA_MODES = ["ENV", "GATE"] as const;
export const CHORUS_MODES = ["OFF", "I", "II", "I+II"] as const;
export const LFO_TRIGGERS = ["AUTO", "MANUAL"] as const;
export const OFF_ON = ["OFF", "ON"] as const;
export const HPF_POSITIONS = ["0", "1", "2", "3"] as const;

const slider = (key: string, byte: number, label: string, section: Section, display = panel): Field =>
  ({ key, byte, label, section, min: 0, max: SLIDER_MAX, display });
const choice = (key: string, byte: number, label: string, section: Section, options: readonly string[]): Field =>
  ({ key, byte, label, section, min: 0, max: options.length - 1, options });

export const VOICE_FIELDS: readonly Field[] = [
  slider("lfoRate", 0, "RATE", "LFO"),
  slider("lfoDelay", 1, "DELAY TIME", "LFO"),
  slider("dcoLfo", 2, "LFO", "DCO"),
  slider("dcoPwm", 3, "PWM", "DCO"),
  slider("dcoSub", 4, "SUB OSC", "DCO"),
  slider("dcoNoise", 5, "NOISE", "DCO"),
  slider("vcfFreq", 6, "FREQ", "VCF"),
  slider("vcfRes", 7, "RES", "VCF"),
  slider("vcfEnv", 8, "ENV", "VCF"),
  slider("vcfLfo", 9, "LFO", "VCF"),
  slider("vcfKybd", 10, "KYBD", "VCF"),
  slider("vcaLevel", 11, "LEVEL", "VCA", centred),
  slider("envA", 12, "A", "ENV"),
  slider("envD", 13, "D", "ENV"),
  slider("envS", 14, "S", "ENV"),
  slider("envR", 15, "R", "ENV"),
  choice("hpf", 16, "FREQ", "HPF", HPF_POSITIONS),
  choice("range", 17, "RANGE", "DCO", RANGES),
  choice("pulse", 18, "PULSE", "DCO", OFF_ON),
  choice("saw", 19, "SAW", "DCO", OFF_ON),
  choice("sub", 20, "SUB", "DCO", OFF_ON),
  choice("pwmMode", 21, "PWM MODE", "DCO", PWM_MODES),
  choice("vcfPolarity", 22, "ENV POLARITY", "VCF", ENV_POLARITIES),
  choice("vcaMode", 23, "MODE", "VCA", VCA_MODES),
  choice("chorus", 24, "CHORUS", "CHORUS", CHORUS_MODES),
  choice("lfoTrigger", 25, "TRIG MODE", "LFO", LFO_TRIGGERS),
];

export const NAME_BYTE = 26;
export const NAME_LENGTH = 16;
export const VOICE_BYTES = NAME_BYTE + NAME_LENGTH; // 42

const byKey = new Map(VOICE_FIELDS.map(f => [f.key, f]));
export function voiceField(key: string): Field {
  const f = byKey.get(key);
  if (!f) throw new Error(`No Juno-60 field "${key}".`);
  return f;
}
export const fieldOf = (byte: number): Field | undefined => VOICE_FIELDS.find(f => f.byte === byte);

// The Juno-60's memory: 56 patches, numbered 11–18 … 71–78 (bank, then number).
export const PATCH_NUMBERS: readonly number[] = Array.from({ length: 56 }, (_, i) => 10 * (Math.floor(i / 8) + 1) + (i % 8) + 1);
