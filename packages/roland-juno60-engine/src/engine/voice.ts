// One of the six voices: DCO (saw, pulse, sub square, noise) → VCF (4-pole resonant low-pass) → VCA, with its own
// envelope and the VCA's gate envelope. The DCO is a phase counter, as the Juno-60's is clocked digitally, and its
// edges are smoothed with PolyBLEP so high notes don't alias. The VCF is a zero-delay-feedback ladder with a soft
// clip at its input: written for this engine from the general four-pole OTA filter, not from any code.

import { GATE_ATTACK, GATE_RELEASE, KYBD_CENTRE, NOISE_LOWPASS_HZ, PULSE_LEVEL, SAW_LEVEL, VCF_DRIVE } from "./calibration.ts";
import { Envelope } from "./env.ts";
import {
  ATTACK, CUTOFF_OCT, DECAY, ENV_OCT, GAIN, KYBD, LFO_OCT, NOISE_MIX, PULSE, PWM_DEPTH, PWM_ENV, PWM_LFO, PWM_MODE,
  RANGE_RATIO_, RELEASE, RES_K, SAW, SUB_MIX, SUSTAIN, VCA_GATE, VIBRATO,
} from "./patch.ts";

const PHASE = 0, SUB = 1, NLP = 2, S1 = 3, S2 = 4, S3 = 5, S4 = 6; // indices into Voice.st

export class Voice {
  key = -1; // the MIDI note, −1 when free
  started = 0; // allocation order
  released = false;
  // per-sample state in typed arrays, so render() never boxes a number:
  // DCO phase (0..1), the sub square's half (0 or 0.5), noise low-pass, the VCF's four stages
  private readonly st = new Float64Array(7);
  private readonly rng = new Int32Array(1); // the noise generator's xorshift state
  private readonly env: Envelope;
  private readonly gateEnv: Envelope;
  private readonly fs: number;
  private readonly noiseCoef: number;

  constructor(sampleRate: number, seed: number) {
    this.fs = sampleRate;
    this.env = new Envelope(sampleRate);
    this.gateEnv = new Envelope(sampleRate);
    this.gateEnv.times.set([GATE_ATTACK, 0, 1, GATE_RELEASE]);
    this.rng[0] = seed | 1;
    this.noiseCoef = 1 - Math.exp((-2 * Math.PI * NOISE_LOWPASS_HZ) / sampleRate);
  }

  start(key: number, order: number): void {
    if (this.key < 0) { this.st.fill(0, NLP); this.env.reset(); this.gateEnv.reset(); }
    this.key = key;
    this.started = order;
    this.released = false;
    this.env.gate();
    this.gateEnv.gate();
  }

  release(): void {
    this.released = true;
    this.env.release();
    this.gateEnv.release();
  }

  // Adds `frames` samples into out[from…]. ctl[0] is the block's LFO value (−1..1, delay applied); it comes in a
  // typed array because a number argument would be boxed on every call.
  render(out: Float64Array, from: number, frames: number, p: Float64Array, ctl: Float64Array): void {
    const lfo = ctl[0]!;
    const fs = this.fs;
    const freq = 440 * Math.pow(2, (this.key - 69 + lfo * p[VIBRATO]!) / 12) * p[RANGE_RATIO_]!;
    const dt = Math.min(0.45, freq / fs);
    const et = this.env.times;
    et[0] = p[ATTACK]!; et[1] = p[DECAY]!; et[2] = p[SUSTAIN]!; et[3] = p[RELEASE]!;
    const envOut = this.env.out, gateOut = this.gateEnv.out;
    const subLevel = p[SUB_MIX]!, noiseLevel = p[NOISE_MIX]!, pwmDepth = p[PWM_DEPTH]!, k = p[RES_K]!, envOct = p[ENV_OCT]!, gain = p[GAIN]!;
    const baseOct = p[CUTOFF_OCT]! + lfo * p[LFO_OCT]! + (p[KYBD]! * (this.key - KYBD_CENTRE)) / 12;
    const maxHz = 0.45 * fs;
    const saw = p[SAW] === 1, pulse = p[PULSE] === 1, gate = p[VCA_GATE] === 1, pwmMode = p[PWM_MODE]!;

    const st = this.st, rng = this.rng;
    for (let i = 0; i < frames; i++) {
      this.env.step();
      this.gateEnv.step();
      const e = envOut[0]!;
      const amp = gate ? gateOut[0]! : e; // in GATE mode the ADSR still shapes the VCF and PWM

      // DCO
      let ph = st[PHASE]! + dt;
      if (ph >= 1) { ph -= 1; st[SUB] = st[SUB]! >= 0.5 ? 0 : 0.5; }
      st[PHASE] = ph;
      let x = 0;
      if (saw) x += (2 * ph - 1 - blep(ph, dt)) * SAW_LEVEL;
      if (pulse) {
        const sweep = pwmMode === PWM_LFO ? (lfo + 1) * 0.5 : pwmMode === PWM_ENV ? e : 1;
        const width = 0.5 - pwmDepth * sweep;
        let sq = ph < width ? 1 : -1;
        sq += blep(ph, dt);
        let q = ph - width; if (q < 0) q += 1;
        sq -= blep(q, dt);
        x += sq * PULSE_LEVEL;
      }
      if (subLevel > 0) {
        const sp = st[SUB]! + ph * 0.5; // the sub's phase within its own (double-length) cycle
        let sq = sp < 0.5 ? 1 : -1;
        sq += blep(sp, dt * 0.5);
        let q = sp - 0.5; if (q < 0) q += 1;
        sq -= blep(q, dt * 0.5);
        x += sq * subLevel;
      }
      if (noiseLevel > 0) {
        let n = rng[0]!;
        n ^= n << 13; n ^= n >>> 17; n ^= n << 5;
        rng[0] = n;
        const lp = st[NLP]! + ((n | 0) / 2147483648 - st[NLP]!) * this.noiseCoef;
        st[NLP] = lp;
        x += lp * 2 * noiseLevel;
      }

      // VCF
      const fc = Math.min(maxHz, Math.max(5, Math.pow(2, baseOct + envOct * e)));
      const g = Math.tan((Math.PI * fc) / fs);
      const G = g / (1 + g), b = 1 / (1 + g);
      const s1 = st[S1]!, s2 = st[S2]!, s3 = st[S3]!, s4 = st[S4]!;
      const S = G * G * G * b * s1 + G * G * b * s2 + G * b * s3 + b * s4;
      let u = (x * VCF_DRIVE * 0.5 - k * S) / (1 + k * G * G * G * G);
      u = Math.tanh(u);
      let v = (u - s1) * G; const y1 = v + s1; st[S1] = y1 + v;
      v = (y1 - s2) * G; const y2 = v + s2; st[S2] = y2 + v;
      v = (y2 - s3) * G; const y3 = v + s3; st[S3] = y3 + v;
      v = (y3 - s4) * G; const y4 = v + s4; st[S4] = y4 + v;

      out[from + i] = out[from + i]! + y4 * (1 + k * 0.35) * amp * gain;
    }
    if (gate ? this.gateEnv.idle : this.env.idle) this.key = -1;
  }
}

// PolyBLEP residual for a discontinuity at phase 0 (t in 0..1, dt the phase step)
function blep(t: number, dt: number): number {
  if (t < dt) { const x = t / dt; return x + x - x * x - 1; }
  if (t > 1 - dt) { const x = (t - 1) / dt; return x * x + x + x + 1; }
  return 0;
}
