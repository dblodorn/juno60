// One envelope: a capacitor charging and discharging through the ADSR's resistances, as Harman measured it. The
// attack charges towards ATTACK_TARGET and stops at full level, so it lands at 1 exactly at the attack time;
// decay and release fall towards a point just past their goal (sustain, or zero) for the same reason.

import { ATTACK_TARGET, FALL_SHAPE } from "./calibration.ts";

const IDLE = 0, ATTACK = 1, DECAY = 2, SUSTAIN = 3, RELEASE = 4;
// how far past its goal a fall aims, relative to the distance it falls, so it arrives at its time
const OVERSHOOT = Math.exp(-FALL_SHAPE) / (1 - Math.exp(-FALL_SHAPE));

export class Envelope {
  // Numbers in and out go through typed arrays, never arguments or return values, so a call that isn't inlined
  // still doesn't box them: `times` is attack, decay, sustain (0–1), release (seconds), set by the caller;
  // `out[0]` is the level after each step().
  readonly times = new Float64Array(4);
  readonly out = new Float64Array(1);
  private stage = IDLE;
  private readonly rate: number; // 1 / sample rate

  constructor(sampleRate: number) { this.rate = 1 / sampleRate; }

  get idle(): boolean { return this.stage === IDLE; }
  get releasing(): boolean { return this.stage === RELEASE; }

  // from the current level, as an analog envelope retriggers
  gate(): void { this.stage = ATTACK; }
  release(): void { if (this.stage !== IDLE) this.stage = RELEASE; }
  reset(): void { this.stage = IDLE; this.out[0] = 0; }

  // One sample.
  step(): void {
    const t = this.times, attack = t[0]!, decay = t[1]!, sustain = t[2]!, release = t[3]!;
    let l = this.out[0]!;
    switch (this.stage) {
      case ATTACK:
        l += (ATTACK_TARGET - l) * coef(attack, this.rate);
        if (l >= 1) { l = 1; this.stage = DECAY; }
        break;
      case DECAY: {
        const goal = sustain - (1 - sustain) * OVERSHOOT;
        l += (goal - l) * coef(decay / FALL_SHAPE, this.rate);
        if (l <= sustain) { l = sustain; this.stage = SUSTAIN; }
        break;
      }
      case SUSTAIN:
        l += (sustain - l) * 0.002; // the sustain slider moved: follow it smoothly
        break;
      case RELEASE:
        l += (-OVERSHOOT - l) * coef(release / FALL_SHAPE, this.rate);
        if (l <= 0) { l = 0; this.stage = IDLE; }
        break;
    }
    this.out[0] = l;
  }
}

// one-pole step for time constant `tau` seconds
function coef(tau: number, rate: number): number {
  return tau <= rate ? 1 : 1 - Math.exp(-rate / tau);
}
