import { test } from "node:test";
import assert from "node:assert/strict";
import { Engine } from "../src/engine/engine.ts";
import { arpStepsPerSecond, ARP_GATE } from "../src/engine/calibration.ts";
import { patch } from "./voices.ts";

const SR = 48000;
const MODES = { UP: 0, DOWN: 1, UP_DOWN: 2 } as const;
const name = (n: number): string => ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][n % 12]! + (Math.floor(n / 12) - 1);

// An engine with a plain patch; run() renders and collects the arpeggio's steps (sample time and note) from the
// engine's step log. gatedNow() is the keys gated at the end of the last rendered block: the engine renders 32
// samples ahead, so checks of it allow a block either way.
const BLOCK = 32;
function rig() {
  const e = new Engine(SR);
  e.setPatch(patch());
  const l = new Float32Array(BLOCK), r = new Float32Array(BLOCK), keys = new Int16Array(6), log = new Float64Array(512);
  const steps: { t: number; note: number }[] = [];
  const run = (samples: number) => {
    for (let done = 0; done < samples;) {
      const n = Math.min(BLOCK, samples - done);
      e.render(l, r, n);
      done += n;
      const k = e.steps(steps.length, log);
      for (let i = 0; i < k; i++) steps.push({ t: log[2 * i]!, note: log[2 * i + 1]! });
    }
  };
  const gatedNow = () => Array.from(keys.subarray(0, e.gated(keys))).sort((a, b) => a - b);
  return { e, run, steps, gatedNow };
}
const stepLen = (rate: number) => SR / arpStepsPerSecond((rate * 10) / 127);
const names = (s: { note: number }[]) => s.map(x => name(x.note)).join(" ");

test("UP over two octaves", () => {
  const { e, run, steps } = rig();
  e.setArpeggio(true, MODES.UP, 2, 100);
  for (const n of [60, 64, 67]) e.noteOn(n);
  run(Math.ceil(stepLen(100) * 7.5));
  assert.equal(names(steps.slice(0, 7)), "C4 E4 G4 C5 E5 G5 C4");
});

test("DOWN over one octave", () => {
  const { e, run, steps } = rig();
  e.setArpeggio(true, MODES.DOWN, 1, 100);
  for (const n of [60, 64, 67]) e.noteOn(n);
  run(Math.ceil(stepLen(100) * 4.5));
  assert.equal(names(steps.slice(0, 4)), "G4 E4 C4 G4");
});

test("UP_DOWN doesn't repeat the ends", () => {
  const { e, run, steps } = rig();
  e.setArpeggio(true, MODES.UP_DOWN, 1, 100);
  for (const n of [60, 64, 67]) e.noteOn(n);
  run(Math.ceil(stepLen(100) * 5.5));
  assert.equal(names(steps.slice(0, 5)), "C4 E4 G4 E4 C4");
});

test("steps start on their sample, 10 s at a fixed rate", () => {
  const { e, run, steps } = rig();
  const len = stepLen(77);
  e.setArpeggio(true, MODES.UP, 3, 77);
  for (const n of [48, 55, 60, 64]) e.noteOn(n);
  run(10 * SR);
  const first = steps[0]!.t;
  assert.ok(steps.length > 20);
  for (let k = 0; k < steps.length; k++) assert.ok(Math.abs(steps[k]!.t - first - k * len) <= 1, `step ${k} at ${steps[k]!.t}`);
});

test("each step is released at the gate, before the next starts", () => {
  const { e, run, gatedNow } = rig();
  const len = stepLen(64);
  e.setArpeggio(true, MODES.UP, 1, 64);
  e.noteOn(60); e.noteOn(64);
  run(Math.floor(len * ARP_GATE) - 2 * BLOCK);
  assert.deepEqual(gatedNow(), [60]);
  run(4 * BLOCK);
  assert.deepEqual(gatedNow(), []);
});

test("a note added mid-sequence joins from the next step without restarting", () => {
  const { e, run, steps } = rig();
  const len = stepLen(100);
  e.setArpeggio(true, MODES.UP, 1, 100);
  e.noteOn(60); e.noteOn(67);
  run(Math.ceil(len * 1.5)); // C4, then G4 has started
  e.noteOn(64);
  run(Math.ceil(len * 3));
  assert.equal(names(steps.slice(0, 5)), "C4 G4 C4 E4 G4");
});

test("releasing every key stops it; the next key starts again from the first step", () => {
  const { e, run, steps, gatedNow } = rig();
  const len = stepLen(100);
  e.setArpeggio(true, MODES.UP, 1, 100);
  e.noteOn(60); e.noteOn(64);
  run(Math.ceil(len * 1.2));
  e.noteOff(60); e.noteOff(64);
  run(Math.ceil(len * 2));
  assert.deepEqual(gatedNow(), []);
  const before = steps.length;
  e.noteOn(67); e.noteOn(72);
  run(Math.ceil(len * 0.2) + BLOCK);
  assert.equal(name(steps[before]!.note), "G4");
});

test("switching on with a chord held arpeggiates it; switching off ends the step", () => {
  const { e, run, gatedNow } = rig();
  e.noteOn(60); e.noteOn(64); e.noteOn(67);
  run(100);
  assert.deepEqual(gatedNow(), [60, 64, 67]);
  e.setArpeggio(true, MODES.UP, 1, 64);
  run(2 * BLOCK);
  assert.deepEqual(gatedNow(), [60]);
  e.setArpeggio(false, MODES.UP, 1, 64);
  run(2 * BLOCK);
  assert.deepEqual(gatedNow(), []);
});

test("a patch change keeps the arpeggio", () => {
  const { e, run, steps } = rig();
  const len = stepLen(100);
  e.setArpeggio(true, MODES.UP, 1, 100);
  e.noteOn(60); e.noteOn(64);
  run(Math.ceil(len * 1.5));
  e.setPatch(patch({ pulse: 1, saw: 0 }));
  run(Math.ceil(len * 2));
  assert.equal(names(steps.slice(0, 4)), "C4 E4 C4 E4");
});

test("HOLD latches, a new chord replaces, HOLD off releases, all notes off clears", () => {
  const { e, run, steps } = rig();
  const len = stepLen(100);
  e.setArpeggio(true, MODES.UP, 1, 100);
  e.setHold(true);
  e.noteOn(60); e.noteOn(64); e.noteOff(60); e.noteOff(64);
  run(Math.ceil(len * 3.5));
  assert.equal(names(steps.slice(0, 4)), "C4 E4 C4 E4");
  e.noteOn(67); e.noteOff(67); // a new chord after every key was let go
  const k = steps.length;
  run(Math.ceil(len * 2.5));
  assert.ok(steps.slice(k).every(s => s.note === 67));
  e.setHold(false);
  const k2 = steps.length;
  run(Math.ceil(len * 2));
  assert.equal(steps.length, k2); // nothing physically held: stopped
  e.setHold(true);
  e.noteOn(60); e.noteOff(60);
  e.allOff();
  const k3 = steps.length;
  run(Math.ceil(len * 2));
  assert.equal(steps.length, k3);
});

test("HOLD with the arpeggiator off sustains released keys", () => {
  const { e, run, gatedNow } = rig();
  e.setHold(true);
  e.noteOn(60); e.noteOn(64); e.noteOff(60); e.noteOff(64);
  run(100);
  assert.deepEqual(gatedNow(), [60, 64]);
  e.noteOn(67);
  run(BLOCK);
  assert.deepEqual(gatedNow(), [67]);
  e.setHold(false);
  run(BLOCK);
  assert.deepEqual(gatedNow(), [67]); // still physically down
});

test("the arpeggiator off plays chords as before", () => {
  const { e, run, gatedNow } = rig();
  e.setArpeggio(false, MODES.UP, 3, 127);
  e.noteOn(60); e.noteOn(64); e.noteOn(67);
  run(1000);
  assert.deepEqual(gatedNow(), [60, 64, 67]);
});
