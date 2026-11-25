// The Juno-60 emulator, shared by the AudioWorklet and the offline synth: six preallocated voices, one LFO, the
// shared HPF and chorus, rendered in blocks of N samples. render() adds into its outputs and never allocates.
//
// Unlike the DX7 engine, a new patch applies at once to notes already sounding: the Juno-60's panel is live, and
// moving a slider changes what you hear.

import { ARP_GATE, arpStepsPerSecond, N, OUTPUT_SCALE, POLYPHONY } from "./calibration.ts";
import { Arp, type ArpTarget } from "./arp.ts";
import { Chorus, Hpf } from "./effects.ts";
import { Lfo } from "./lfo.ts";
import { CHORUS, decodePatch, HPF, PATCH_VALUES } from "./patch.ts";
import { Voice } from "./voice.ts";

export { POLYPHONY };
const STEP_LOG = 256;

export class Engine implements ArpTarget {
  readonly sampleRate: number;
  private readonly patch = new Float64Array(PATCH_VALUES);
  private loaded = false;
  private readonly voices: Voice[] = [];
  private readonly lfo: Lfo;
  private readonly hpf: Hpf;
  private readonly chorus: Chorus;
  private readonly mix = new Float64Array(N);
  private readonly left = new Float64Array(N);
  private readonly right = new Float64Array(N);
  private readonly ctl = new Float64Array(1); // the block's LFO value, handed to the voices
  private blockPos = N; // samples of the current block already handed out
  private clock = 0;
  private next = 0; // the voice the assigner tries first
  private readonly arp = new Arp(this); // keys reach the voices through it
  private readonly stepLog = new Float64Array(STEP_LOG * 2); // the latest steps' [sample, note]
  private stepCount = 0;
  private now = 0; // the sample being rendered, counted from the first block
  private blockStart = 0;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
    this.lfo = new Lfo(sampleRate, N);
    this.hpf = new Hpf(sampleRate);
    this.chorus = new Chorus(sampleRate);
    for (let i = 0; i < POLYPHONY; i++) this.voices.push(new Voice(sampleRate, 0x9e3779b9 * (i + 1)));
  }

  // bytes already checked by codec.readVoice
  setPatch(bytes: Uint8Array): void {
    decodePatch(bytes, this.patch);
    this.loaded = true;
  }
  get hasPatch(): boolean { return this.loaded; }

  // Keys: through the arpeggiator, which plays them straight through while it's off (HOLD aside).
  noteOn(note: number): void { this.arp.noteOn(note); }
  noteOff(note: number): void { this.arp.noteOff(note); }
  allOff(): void {
    this.arp.allOff();
    for (const v of this.voices) v.key = -1;
  }

  // values already checked by readArpeggio: mode 0 UP, 1 DOWN, 2 UP_DOWN; range 1–3; rate 0–127
  setArpeggio(on: boolean, mode: number, range: number, rate: number): void {
    this.arp.set(on, mode, range, this.sampleRate / arpStepsPerSecond((rate * 10) / 127), ARP_GATE);
  }
  setHold(on: boolean): void { this.arp.setHold(on); }

  // A key already sounding restarts on its own voice. Otherwise voices are taken in turn (the next free one after
  // the last used), then the oldest released one, then the oldest. Loops, not closures: the arpeggiator calls
  // this from inside render().
  voiceOn(note: number): void {
    if (!this.loaded) return;
    const vs = this.voices;
    let gated = false, v: Voice | undefined;
    for (let i = 0; i < POLYPHONY; i++) { const x = vs[i]!; if (x.key >= 0 && !x.released) gated = true; if (x.key === note) v = x; }
    if (!gated) this.lfo.restart();
    for (let i = 0; i < POLYPHONY && !v; i++) {
      const c = vs[(this.next + i) % POLYPHONY]!;
      if (c.key < 0) v = c;
    }
    v ??= this.oldest(true) ?? this.oldest(false)!;
    this.next = (vs.indexOf(v) + 1) % POLYPHONY;
    v.start(note, ++this.clock);
  }

  voiceOff(note: number): void {
    for (let i = 0; i < POLYPHONY; i++) { const v = this.voices[i]!; if (v.key === note && !v.released) v.release(); }
  }

  // An arpeggio step: logged with its sample time, then played like a key.
  stepOn(note: number): void {
    const i = (this.stepCount % STEP_LOG) * 2;
    this.stepLog[i] = this.now;
    this.stepLog[i + 1] = note;
    this.stepCount++;
    this.voiceOn(note);
  }

  // The arpeggio steps since `since` (a count from stepsPlayed), as [sample, note] pairs into out; how many. Only the
  // last STEP_LOG are kept. For tests and meters.
  get stepsPlayed(): number { return this.stepCount; }
  steps(since: number, out: Float64Array): number {
    let k = 0;
    for (let s = Math.max(since, this.stepCount - STEP_LOG); s < this.stepCount && 2 * k + 1 < out.length; s++, k++) {
      const i = (s % STEP_LOG) * 2;
      out[2 * k] = this.stepLog[i]!;
      out[2 * k + 1] = this.stepLog[i + 1]!;
    }
    return k;
  }

  // The keys of voices still gated (not released) into out; how many. For tests and meters.
  gated(out: Int16Array): number {
    let k = 0;
    for (let i = 0; i < POLYPHONY; i++) { const v = this.voices[i]!; if (v.key >= 0 && !v.released) out[k++] = v.key; }
    return k;
  }

  sounding(): number {
    let k = 0;
    for (const v of this.voices) if (v.key >= 0) k++;
    return k;
  }

  // Adds `frames` samples into left[offset…] and right[offset…].
  render(left: Float32Array, right: Float32Array, frames: number, offset = 0): void {
    let i = 0;
    while (i < frames) {
      if (this.blockPos === N) this.renderBlock();
      const n = Math.min(N - this.blockPos, frames - i);
      for (let k = 0; k < n; k++) {
        const o = offset + i + k, b = this.blockPos + k;
        left[o] = left[o]! + this.left[b]!;
        right[o] = right[o]! + this.right[b]!;
      }
      this.blockPos += n;
      i += n;
    }
  }

  private renderBlock(): void {
    const p = this.patch;
    this.mix.fill(0);
    this.lfo.advance(p, this.ctl);
    // split the block at the arpeggiator's events, so each step starts on its own sample
    for (let a = 0; a < N;) {
      this.now = this.blockStart + a;
      this.arp.fire();
      const n = this.arp.until(N - a);
      for (let i = 0; i < POLYPHONY; i++) { const v = this.voices[i]!; if (v.key >= 0) v.render(this.mix, a, n, p, this.ctl); }
      this.arp.pass(n);
      a += n;
    }
    this.hpf.process(this.mix, N, p[HPF]!);
    this.chorus.process(this.mix, this.left, this.right, N, p[CHORUS]!);
    for (let k = 0; k < N; k++) { this.left[k] = this.left[k]! * OUTPUT_SCALE; this.right[k] = this.right[k]! * OUTPUT_SCALE; }
    this.blockPos = 0;
    this.blockStart += N;
  }

  private oldest(releasedOnly: boolean): Voice | undefined {
    let best: Voice | undefined;
    for (const v of this.voices) if ((!releasedOnly || v.released) && (!best || v.started < best.started)) best = v;
    return best;
  }
}
