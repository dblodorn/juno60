// The Juno-60's one LFO: a triangle shared by every voice, with DELAY TIME fading it in after a key goes down.
// In AUTO trigger mode the delay restarts when a key goes down with no other key held; in MANUAL it is started by
// the LFO trigger button on the bender, which this emulator doesn't have, so MANUAL plays the LFO at full depth.

import { LFO_DELAY } from "./calibration.ts";
import { LFO_DELAY as DELAY, LFO_HZ, LFO_MANUAL } from "./patch.ts";

export class Lfo {
  private readonly st = new Float64Array([0, 1e9]); // phase (0..1), seconds since the delay restarted
  private readonly dt: number; // seconds per call of advance()

  constructor(sampleRate: number, block: number) { this.dt = block / sampleRate; }

  restart(): void { this.st[1] = 0; }

  // Advances one block and writes the triangle (−1..1) times the delay's fade to out[0] (a typed array, so the
  // number isn't boxed).
  advance(p: Float64Array, out: Float64Array): void {
    const st = this.st;
    let ph = st[0]! + p[LFO_HZ]! * this.dt;
    ph -= Math.floor(ph);
    st[0] = ph;
    const tri = ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph;
    const t = st[1]! + this.dt;
    st[1] = t;
    out[0] = p[LFO_MANUAL] === 1 ? tri : tri * fade(p[DELAY]!, t);
  }
}

// 0 during the silent part of the delay, then a linear rise to 1 over the fade-in
function fade(s: number, t: number): number {
  let i = 0;
  while (i < LFO_DELAY.length - 2 && s > LFO_DELAY[i + 1]![0]) i++;
  const a = LFO_DELAY[i]!, b = LFO_DELAY[i + 1]!;
  const x = Math.min(1, Math.max(0, (s - a[0]) / (b[0] - a[0])));
  const silent = a[1] + (b[1] - a[1]) * x, rise = a[2] + (b[2] - a[2]) * x;
  if (t <= silent) return 0;
  return rise <= 0 ? 1 : Math.min(1, (t - silent) / rise);
}
