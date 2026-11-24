// The Juno-60 emulator, shared by the AudioWorklet and the offline synth: six preallocated voices, one LFO, the
// shared HPF and chorus, rendered in blocks of N samples. render() adds into its outputs and never allocates.
//
// Unlike the DX7 engine, a new patch applies at once to notes already sounding: the Juno-60's panel is live, and
// moving a slider changes what you hear.

import { N, OUTPUT_SCALE, POLYPHONY } from "./calibration.ts";
import { Chorus, Hpf } from "./effects.ts";
import { Lfo } from "./lfo.ts";
import { CHORUS, decodePatch, HPF, PATCH_VALUES } from "./patch.ts";
import { Voice } from "./voice.ts";

export { POLYPHONY };

export class Engine {
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

  // A key already sounding restarts on its own voice. Otherwise voices are taken in turn (the next free one after
  // the last used), then the oldest released one, then the oldest.
  noteOn(note: number): void {
    if (!this.loaded) return;
    if (!this.voices.some(v => v.key >= 0 && !v.released)) this.lfo.restart();
    let v = this.voices.find(x => x.key === note);
    if (!v) {
      for (let i = 0; i < POLYPHONY && !v; i++) {
        const c = this.voices[(this.next + i) % POLYPHONY]!;
        if (c.key < 0) v = c;
      }
    }
    v ??= this.oldest(true) ?? this.oldest(false)!;
    this.next = (this.voices.indexOf(v) + 1) % POLYPHONY;
    v.start(note, ++this.clock);
  }

  noteOff(note: number): void {
    for (const v of this.voices) if (v.key === note && !v.released) v.release();
  }

  allOff(): void {
    for (const v of this.voices) v.key = -1;
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
    for (let i = 0; i < POLYPHONY; i++) { const v = this.voices[i]!; if (v.key >= 0) v.render(this.mix, 0, N, p, this.ctl); }
    this.hpf.process(this.mix, N, p[HPF]!);
    this.chorus.process(this.mix, this.left, this.right, N, p[CHORUS]!);
    for (let k = 0; k < N; k++) { this.left[k] = this.left[k]! * OUTPUT_SCALE; this.right[k] = this.right[k]! * OUTPUT_SCALE; }
    this.blockPos = 0;
  }

  private oldest(releasedOnly: boolean): Voice | undefined {
    let best: Voice | undefined;
    for (const v of this.voices) if ((!releasedOnly || v.released) && (!best || v.started < best.started)) best = v;
    return best;
  }
}
