// What all six voices share after they're summed: the high-pass filter, then the chorus.

import { CHORUS, CHORUS_LOWPASS_HZ, CHORUS_WET, HPF_HZ } from "./calibration.ts";

// One-pole high-pass at the HPF slider's position (0 passes everything).
export class Hpf {
  private readonly st = new Float64Array(2); // last input, last output
  private readonly fs: number;
  constructor(sampleRate: number) { this.fs = sampleRate; }

  process(buf: Float64Array, frames: number, position: number): void {
    const hz = HPF_HZ[position as 0 | 1 | 2 | 3] ?? 0;
    if (!hz) { this.st[0] = this.st[1] = buf[frames - 1] ?? 0; return; }
    const a = 1 / (1 + (2 * Math.PI * hz) / this.fs);
    let x1 = this.st[0]!, y1 = this.st[1]!;
    for (let i = 0; i < frames; i++) {
      const x = buf[i]!;
      y1 = a * (y1 + x - x1);
      x1 = x;
      buf[i] = y1;
    }
    this.st[0] = x1; this.st[1] = y1;
  }
}

// The chorus: a 12 dB/oct low-pass feeds two bucket-brigade delay lines swept by one triangle LFO, the right line in
// antiphase; each output is the dry signal plus one line. In I+II both lines sweep together (a fast, narrow vibrato),
// so the output is mono. The BBDs' slight rounding is a soft clip.
const SIZE = 4096; // delay buffer, a power of two: over 20 ms at 192 kHz

export class Chorus {
  private readonly buf = new Float64Array(SIZE);
  private w = 0;
  private readonly st = new Float64Array(4); // LFO phase, the two low-pass stages, the effect's fade (0..1)
  private readonly lpCoef: number;
  private readonly fs: number;
  private mode = 0;

  constructor(sampleRate: number) {
    this.fs = sampleRate;
    this.lpCoef = 1 - Math.exp((-2 * Math.PI * CHORUS_LOWPASS_HZ) / sampleRate);
  }

  // mono in → left and right (written, not added)
  process(input: Float64Array, left: Float64Array, right: Float64Array, frames: number, mode: number): void {
    if (mode !== 0) this.mode = mode;
    const target = mode === 0 ? 0 : 1;
    const c = CHORUS[this.mode as 1 | 2 | 3] ?? CHORUS[1];
    const step = c.hz / this.fs;
    const minD = (c.minMs / 1000) * this.fs, span = ((c.maxMs - c.minMs) / 1000) * this.fs;
    const fade = 1 / (0.005 * this.fs);
    const st = this.st;
    let phase = st[0]!, lp1 = st[1]!, lp2 = st[2]!, mix = st[3]!;
    for (let i = 0; i < frames; i++) {
      const x = input[i]!;
      lp1 += (x - lp1) * this.lpCoef;
      lp2 += (lp1 - lp2) * this.lpCoef;
      this.buf[this.w] = Math.tanh(lp2 * 1.2) / 1.2;

      phase += step;
      if (phase >= 1) phase -= 1;
      const tri = phase < 0.5 ? 4 * phase - 1 : 3 - 4 * phase; // −1..1
      const l = this.tap(minD + span * (0.5 + 0.5 * tri));
      const r = c.mono ? l : this.tap(minD + span * (0.5 - 0.5 * tri));
      this.w = (this.w + 1) & (SIZE - 1);

      mix += Math.max(-fade, Math.min(fade, target - mix)); // fades in and out over 5 ms when the mode changes
      const wet = CHORUS_WET * mix;
      left[i] = x + l * wet;
      right[i] = x + r * wet;
    }
    st[0] = phase; st[1] = lp1; st[2] = lp2; st[3] = mix;
    if (mode === 0 && mix === 0) this.mode = 0;
  }

  // the line read `d` samples behind the write point, linearly interpolated
  private tap(d: number): number {
    const pos = this.w - d;
    const i = Math.floor(pos), f = pos - i;
    const a = this.buf[i & (SIZE - 1)]!, b = this.buf[(i + 1) & (SIZE - 1)]!;
    return a + (b - a) * f;
  }
}
