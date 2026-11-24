// The one file of numbers that describe how the Juno-60 sounds. Each is labelled:
//   MEASURED  from Andy Harman's measurements of a Juno-60 (github.com/pendragon-andyh/Juno60, MIT): his formulas and
//             tables, ported here.
//   PANEL     from the instrument's published description (Wikipedia's article, the factory patch sheet).
//   ESTIMATE  ours, by ear and from the circuit's general shape, until compared with recordings (issue: calibration).
// Changing a number changes the sound: release at least a minor version of the package, with a changelog line.

// Panel slider readings are 0–10 (params.ts toPanel); `s` below is that reading.

export const N = 32; // samples per control block (LFO and smoothing)
export const POLYPHONY = 6; // PANEL: 6 voices

// ---------- envelope (one ADSR per voice) ----------

// MEASURED: attack time from 1 ms to 3.25 s, logarithmic in the slider (Harman, Envelope/Attack).
export const attackSeconds = (s: number): number => 0.001 + ((Math.exp(s * 0.5) - 1) / (Math.exp(5) - 1)) * 3.25;
// MEASURED: decay and release share one curve, 2 ms to about 17.5 s (Harman, Envelope/Decay and Release).
export const decaySeconds = (s: number): number => 0.002 + ((Math.exp(s * 0.4) - 1) / (Math.exp(4) - 1)) * s * 0.1 * 17.46;
// MEASURED: the attack is a capacitor charging towards 1/0.632 of full level, stopped at full level:
// level = (1 − e^(−x)) / 0.632 over the attack time.
export const ATTACK_TARGET = 1 / (1 - Math.exp(-1));
// MEASURED: decay and release fall as e^(−3.5x) over their time, landing on the sustain level (or zero).
export const FALL_SHAPE = 3.5;
// MEASURED: VCA GATE is a fixed 3 ms attack and 6 ms release (Harman, Envelope/Gate).
export const GATE_ATTACK = 0.003;
export const GATE_RELEASE = 0.006;

// ---------- LFO (one for the whole instrument, triangle) ----------

// ESTIMATE: rate from 0.3 Hz to 20 Hz, exponential in the slider.
export const lfoHz = (s: number): number => 0.3 * Math.pow(20 / 0.3, s / 10);
// MEASURED: DELAY TIME, as [slider, silent seconds, fade-in seconds] (Harman, LFO/Delay); linear between rows.
export const LFO_DELAY: readonly (readonly [number, number, number])[] = [
  [0, 0, 0],
  [2.5, 0.0639, 0.053],
  [5, 0.85, 0.188],
  [7.5, 1.2, 0.348],
  [10, 2.786, 1],
];

// ---------- DCO ----------

export const RANGE_RATIO = [0.5, 1, 2] as const; // PANEL: 16', 8', 4' (8' at concert pitch)
// ESTIMATE: DCO LFO depth, semitones at the LFO's peak per slider step (10 = ±3 semitones).
export const DCO_LFO_SEMITONES = 0.3;
// ESTIMATE: PWM at 10 narrows the pulse from 50 % to 3 %; MAN sets it, LFO and ENV sweep it from square.
export const PWM_NARROWEST = 0.03;
// MEASURED (cited by Harman from a filter clone's notes): noise is low-passed at 5 kHz.
export const NOISE_LOWPASS_HZ = 5000;
// ESTIMATE: mix levels of each source at full (saw and pulse are switched in at full level).
export const SAW_LEVEL = 1;
export const PULSE_LEVEL = 1;
export const SUB_LEVEL = 1;
export const NOISE_LEVEL = 0.9;

// ---------- VCF (24 dB/oct resonant low-pass, PANEL) ----------

// ESTIMATE: FREQ from 10 Hz (0) to about 29 kHz (10), exponential.
export const cutoffHz = (s: number): number => 10 * Math.pow(2, s * 1.15);
export const ENV_OCTAVES = 7; // ESTIMATE: ENV at 10 moves the cutoff up to 7 octaves
export const LFO_OCTAVES = 2; // ESTIMATE: LFO at 10 swings the cutoff ±2 octaves
// ESTIMATE: KYBD at 10 tracks the keyboard 1:1 (an octave per octave) around middle C
export const KYBD_CENTRE = 60;
// ESTIMATE: RES feedback; the filter starts to sing near 9 and oscillates at 10
export const resonance = (s: number): number => 4.15 * Math.pow(s / 10, 1.3);
export const VCF_DRIVE = 1.4; // ESTIMATE: how hard the mix hits the filter's input stage

// ---------- VCA ----------

// ESTIMATE: LEVEL −5…+5 is ±10 dB around unity.
export const vcaGain = (s: number): number => Math.pow(10, ((s - 5) * 2) / 20);

// ---------- HPF (shared by all voices, before the chorus) ----------

// MEASURED: Harman's cut-off frequencies for positions 0–3, from the schematic's R and C (6 dB/oct; 0 is off).
export const HPF_HZ = [0, 154, 339, 720] as const;

// ---------- chorus (two BBD lines, one triangle LFO; right line modulated in antiphase) ----------

// MEASURED: modulation rate and delay sweep per mode (Harman, Chorus): I, II, and I+II (both buttons; mono).
export const CHORUS = [
  null,
  { hz: 0.513, minMs: 1.66, maxMs: 5.35, mono: false },
  { hz: 0.863, minMs: 1.66, maxMs: 5.35, mono: false },
  { hz: 9.75, minMs: 3.3, maxMs: 3.7, mono: true },
] as const;
export const CHORUS_WET = 0.7; // ESTIMATE: the delayed signal's level against the dry one
export const CHORUS_LOWPASS_HZ = 9000; // ESTIMATE: the 12 dB/oct filter ahead of the BBDs (its cut-off isn't measured)

// ---------- output ----------

export const OUTPUT_SCALE = 0.25; // ESTIMATE: one saw note at LEVEL 0 peaks near 0.2, so a chord with chorus stays under 1
