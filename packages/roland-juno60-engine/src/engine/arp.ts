// The arpeggiator, between the keys and the voices: it tracks the keys held (and, with HOLD, the latched ones) and,
// while on, plays them one at a time in pitch order over 1–3 octaves, UP, DOWN or UP_DOWN (the ends not repeated).
// Steps are timed in samples, so the engine starts each one on its own sample (Engine.renderBlock splits its block
// at the next event). All state is in typed arrays and nothing allocates, so it can run inside render().
//
// HOLD works with the arpeggiator off too, as on the Juno-60: released keys keep sounding until new keys are played
// after every key was let go, or HOLD is turned off.

export interface ArpTarget {
  voiceOn(note: number): void; // a key played straight through (arpeggiator off)
  voiceOff(note: number): void;
  stepOn(note: number): void; // an arpeggio step
}

export const UP = 0, DOWN = 1, UP_DOWN = 2;

// indices into Arp.st
const ON = 0, MODE = 1, RANGE = 2, STEP_LEN = 3, NEXT_LEN = 4, GATE = 5, STEP = 6, POS = 7, COUNT = 8, SOUNDING = 9,
  HOLD = 10, RUNNING = 11, PHYS = 12, LAST = 13;

export class Arp {
  private readonly held = new Uint8Array(128); // the notes that arpeggiate (or sound, while off): physical and latched
  private readonly phys = new Uint8Array(128); // keys physically down
  private readonly notes = new Int16Array(128); // the held notes in pitch order, st[COUNT] of them
  private readonly st = new Float64Array(14);
  private readonly t: ArpTarget;

  constructor(target: ArpTarget) {
    this.t = target;
    this.st[RANGE] = 1;
    this.st[STEP_LEN] = this.st[NEXT_LEN] = 48000;
    this.st[GATE] = 0.5;
    this.st[SOUNDING] = -1;
  }

  get on(): boolean { return this.st[ON] === 1; }

  // stepSamples applies from the next step; on/off, mode and range at once
  set(on: boolean, mode: number, range: number, stepSamples: number, gate: number): void {
    const st = this.st;
    st[MODE] = mode;
    st[RANGE] = range;
    st[NEXT_LEN] = stepSamples;
    st[GATE] = gate;
    if (st[RUNNING] === 0) st[STEP_LEN] = stepSamples;
    const was = st[ON] === 1;
    st[ON] = on ? 1 : 0;
    if (on && !was) {
      for (let n = 0; n < 128; n++) if (this.held[n] === 1) this.t.voiceOff(n); // the chord stops sounding together
      if (st[COUNT]! > 0) this.start();
    } else if (!on && was) this.stop();
  }

  noteOn(note: number): void {
    const st = this.st;
    if (st[HOLD] === 1 && st[PHYS] === 0) this.clearLatched(); // a new chord after every key was let go replaces it
    if (this.phys[note] === 0) { this.phys[note] = 1; st[PHYS] = st[PHYS]! + 1; }
    this.held[note] = 1;
    this.rebuild();
    if (st[ON] === 0) this.t.voiceOn(note);
    else if (st[RUNNING] === 0) this.start();
  }

  noteOff(note: number): void {
    const st = this.st;
    if (this.phys[note] === 1) { this.phys[note] = 0; st[PHYS] = st[PHYS]! - 1; }
    if (st[HOLD] === 1) return;
    this.held[note] = 0;
    this.rebuild();
    if (st[ON] === 0) this.t.voiceOff(note);
    else if (st[COUNT] === 0) this.stop();
  }

  setHold(on: boolean): void {
    const st = this.st;
    st[HOLD] = on ? 1 : 0;
    if (on) return;
    for (let n = 0; n < 128; n++) {
      if (this.held[n] === 1 && this.phys[n] === 0) { this.held[n] = 0; if (st[ON] === 0) this.t.voiceOff(n); }
    }
    this.rebuild();
    if (st[ON] === 1 && st[COUNT] === 0) this.stop();
  }

  // all notes off: the held and latched notes are cleared, HOLD's too; HOLD itself stays as set
  allOff(): void {
    this.held.fill(0);
    this.phys.fill(0);
    const st = this.st;
    st[COUNT] = 0; st[PHYS] = 0; st[RUNNING] = 0; st[SOUNDING] = -1;
  }

  // Fires every event due now: a step's note-off at its gate, then the next step.
  fire(): void {
    const st = this.st;
    if (st[RUNNING] === 0) return;
    if (st[SOUNDING]! >= 0 && st[POS]! >= st[STEP_LEN]! * st[GATE]!) { this.t.voiceOff(st[SOUNDING]!); st[SOUNDING] = -1; }
    if (st[POS]! >= st[STEP_LEN]!) {
      if (st[SOUNDING]! >= 0) { this.t.voiceOff(st[SOUNDING]!); st[SOUNDING] = -1; }
      st[POS] = st[POS]! - st[STEP_LEN]!; // keep the fraction, so steps don't drift
      st[STEP_LEN] = st[NEXT_LEN]!;
      const len = this.length();
      st[STEP] = (st[STEP]! + 1) % len;
      const note = this.pitch(st[STEP]!);
      this.t.stepOn(note);
      st[SOUNDING] = note;
      st[LAST] = note;
    }
  }

  // Samples from now to the next event, at most max (at least 1).
  until(max: number): number {
    const st = this.st;
    if (st[RUNNING] === 0) return max;
    let next = st[STEP_LEN]! - st[POS]!;
    if (st[SOUNDING]! >= 0) next = Math.min(next, st[STEP_LEN]! * st[GATE]! - st[POS]!);
    return Math.max(1, Math.min(max, Math.ceil(next)));
  }

  pass(frames: number): void {
    if (this.st[RUNNING] === 1) this.st[POS] = this.st[POS]! + frames;
  }

  private start(): void {
    const st = this.st;
    st[RUNNING] = 1;
    st[STEP] = -1;
    st[STEP_LEN] = st[NEXT_LEN]!;
    st[POS] = st[STEP_LEN]!; // the first step is due now
  }

  private stop(): void {
    const st = this.st;
    if (st[SOUNDING]! >= 0) this.t.voiceOff(st[SOUNDING]!);
    st[SOUNDING] = -1;
    st[RUNNING] = 0;
  }

  private clearLatched(): void {
    for (let n = 0; n < 128; n++) {
      if (this.held[n] === 1 && this.phys[n] === 0) { this.held[n] = 0; if (this.st[ON] === 0) this.t.voiceOff(n); }
    }
    this.rebuild();
  }

  // The held notes in pitch order. While running, the step moves to where the last note played sits in the new
  // sequence (or just before where it would), so the arpeggio carries on from it instead of jumping or repeating.
  private rebuild(): void {
    let k = 0;
    for (let n = 0; n < 128; n++) if (this.held[n] === 1) this.notes[k++] = n;
    const st = this.st;
    const wasRunning = st[RUNNING] === 1 && st[STEP]! >= 0 && st[COUNT]! > 0;
    const descending = st[MODE] === DOWN || (st[MODE] === UP_DOWN && st[STEP]! >= st[COUNT]! * st[RANGE]!);
    st[COUNT] = k;
    if (!wasRunning || k === 0) return;
    const l = k * st[RANGE]!, len = this.length(), last = st[LAST]!;
    // the positions of this phase: all of UP or DOWN, the rising or the falling half of UP_DOWN
    const from = st[MODE] === UP_DOWN && descending ? Math.min(l, len - 1) : 0;
    const to = st[MODE] === UP_DOWN && !descending ? Math.min(l, len) : len;
    let best = -1;
    for (let j = from; j < to; j++) {
      const p = this.pitch(j);
      if (p === last) { best = j; break; }
      if (descending ? p > last : p < last) best = j; // the latest position before where `last` would sit
    }
    st[STEP] = best < 0 ? (from + len - 1) % len : best;
  }

  private length(): number {
    const l = this.st[COUNT]! * this.st[RANGE]!;
    return this.st[MODE] === UP_DOWN ? Math.max(1, 2 * l - 2) : Math.max(1, l);
  }

  private pitch(step: number): number {
    const st = this.st, count = st[COUNT]!, l = count * st[RANGE]!;
    let k = step;
    if (st[MODE] === DOWN) k = l - 1 - step;
    else if (st[MODE] === UP_DOWN && step >= l) k = 2 * l - 2 - step;
    let note = this.notes[k % count]! + 12 * Math.floor(k / count);
    while (note > 127) note -= 12;
    return note;
  }
}
