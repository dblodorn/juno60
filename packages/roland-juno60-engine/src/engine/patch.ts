// A patch's bytes as the numbers the engine uses, decoded once when a patch is loaded (never in render). They live
// in one Float64Array, read through the index constants below: an object's numeric fields would change shape as
// values change type, and each change throws away the optimised render code.

import { toPanel } from "../params.ts";
import {
  attackSeconds, cutoffHz, DCO_LFO_SEMITONES, decaySeconds, ENV_OCTAVES, LFO_OCTAVES, lfoHz, NOISE_LEVEL, PWM_NARROWEST,
  RANGE_RATIO, resonance, SUB_LEVEL, vcaGain,
} from "./calibration.ts";

let n = 0;
// switches (0/1 or small integers)
export const SAW = n++, PULSE = n++, PWM_MODE = n++, HPF = n++, CHORUS = n++, VCA_GATE = n++, LFO_MANUAL = n++;
// LFO
export const LFO_HZ = n++, LFO_DELAY = n++;
// DCO
export const RANGE_RATIO_ = n++, VIBRATO = n++, SUB_MIX = n++, NOISE_MIX = n++, PWM_DEPTH = n++;
// VCF: cutoff as log2 Hz, modulation in octaves, keyboard tracking 0–1, resonance feedback
export const CUTOFF_OCT = n++, ENV_OCT = n++, LFO_OCT = n++, KYBD = n++, RES_K = n++;
// VCA gain, envelope times in seconds and sustain 0–1
export const GAIN = n++, ATTACK = n++, DECAY = n++, SUSTAIN = n++, RELEASE = n++;
export const PATCH_VALUES = n;

export const PWM_ENV = 0, PWM_LFO = 2; // PWM_MODE values (1 is MAN)

// bytes already checked by codec.readVoice
export function decodePatch(b: Uint8Array, v: Float64Array): void {
  const s = (i: number): number => toPanel(b[i]!);
  v[SAW] = b[19]!; v[PULSE] = b[18]!; v[PWM_MODE] = b[21]!; v[HPF] = b[16]!; v[CHORUS] = b[24]!;
  v[VCA_GATE] = b[23]!; v[LFO_MANUAL] = b[25]!;
  v[LFO_HZ] = lfoHz(s(0)); v[LFO_DELAY] = s(1);
  v[RANGE_RATIO_] = RANGE_RATIO[b[17]! as 0 | 1 | 2] ?? 1;
  v[VIBRATO] = s(2) * DCO_LFO_SEMITONES;
  v[PWM_DEPTH] = (s(3) / 10) * (0.5 - PWM_NARROWEST);
  v[SUB_MIX] = b[20] === 1 ? (s(4) / 10) * SUB_LEVEL : 0;
  v[NOISE_MIX] = (s(5) / 10) * NOISE_LEVEL;
  v[CUTOFF_OCT] = Math.log2(cutoffHz(s(6)));
  v[RES_K] = resonance(s(7));
  v[ENV_OCT] = (b[22] === 1 ? -1 : 1) * (s(8) / 10) * ENV_OCTAVES;
  v[LFO_OCT] = (s(9) / 10) * LFO_OCTAVES;
  v[KYBD] = s(10) / 10;
  v[GAIN] = vcaGain(s(11));
  v[ATTACK] = attackSeconds(s(12)); v[DECAY] = decaySeconds(s(13)); v[SUSTAIN] = s(14) / 10; v[RELEASE] = decaySeconds(s(15));
}
