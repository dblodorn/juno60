// The engine without Web Audio: for Node (tests, rendering to files) or anywhere samples are wanted directly.
// Same patch loading and note rules as the AudioWorklet synth, and the same engine, so the same calls give the
// same samples.

import { Engine } from "./engine/engine.ts";
import { checkNote, checkSampleRate, noteOnEvent } from "./notes.ts";
import { readVoice } from "./codec.ts";
import { ARPEGGIO_MODES, readArpeggio, type Arpeggio } from "./arpeggio.ts";

export interface OfflineSynth {
  readonly sampleRate: number;
  // 42 patch bytes. Throws on anything else and keeps the patch it had. Notes already sounding take it at once.
  loadVoice(patch: Uint8Array): void;
  // Arpeggiator settings (see arpeggio.ts), kept apart from the patch: loading one never changes the other. Throws
  // on bad settings and keeps the ones it had.
  loadArpeggio(settings: Arpeggio): void;
  // HOLD, a performance switch: never part of the settings.
  setHold(on: boolean): void;
  // note 0-127, velocity 0-127 (0 is a note-off; the Juno-60 has no velocity otherwise). Throws on values out of range.
  noteOn(note: number, velocity?: number): void;
  noteOff(note: number): void;
  allNotesOff(): void;
  // Voices sounding, released ones included until they fall silent.
  sounding(): number;
  // Writes `frames` samples into out[offset…], replacing what was there: left and right averaged.
  render(out: Float32Array, frames?: number, offset?: number): void;
  // The same, in stereo (the chorus is stereo).
  renderStereo(left: Float32Array, right: Float32Array, frames?: number, offset?: number): void;
}

export function createOfflineSynth(sampleRate: number): OfflineSynth {
  const engine = new Engine(checkSampleRate(sampleRate));
  let scratchL = new Float32Array(0), scratchR = new Float32Array(0);
  const check = (len: number, frames: number, offset: number): void => {
    if (offset < 0 || frames < 0 || offset + frames > len) throw new RangeError(`Can't render ${frames} frames at ${offset} into ${len}.`);
  };
  return {
    sampleRate,
    loadVoice(patch) { engine.setPatch(readVoice(patch)); },
    loadArpeggio(settings) {
      const a = readArpeggio(settings);
      engine.setArpeggio(a.on, ARPEGGIO_MODES.indexOf(a.mode), a.range, a.rate);
    },
    setHold(on) { engine.setHold(on === true); },
    noteOn(note, velocity = 100) {
      const e = noteOnEvent(note, velocity);
      if (e.off) engine.noteOff(note); else engine.noteOn(note);
    },
    noteOff(note) { engine.noteOff(checkNote(note)); },
    allNotesOff() { engine.allOff(); },
    sounding() { return engine.sounding(); },
    render(out, frames = out.length, offset = 0) {
      check(out.length, frames, offset);
      if (scratchL.length < frames) { scratchL = new Float32Array(frames); scratchR = new Float32Array(frames); } // grows once
      scratchL.fill(0, 0, frames);
      scratchR.fill(0, 0, frames);
      engine.render(scratchL, scratchR, frames, 0);
      for (let i = 0; i < frames; i++) out[offset + i] = (scratchL[i]! + scratchR[i]!) * 0.5;
    },
    renderStereo(left, right, frames = left.length, offset = 0) {
      check(left.length, frames, offset);
      check(right.length, frames, offset);
      left.fill(0, offset, offset + frames);
      right.fill(0, offset, offset + frames);
      engine.render(left, right, frames, offset);
    },
  };
}
