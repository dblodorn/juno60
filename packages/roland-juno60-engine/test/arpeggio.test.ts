import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_ARPEGGIO, readArpeggio } from "../src/arpeggio.ts";
import { arpStepsPerSecond } from "../src/engine/calibration.ts";
import { createOfflineSynth } from "../src/offline.ts";
import { patch } from "./voices.ts";

const ok = { version: 1, on: true, mode: "UP_DOWN", range: 2, rate: 90 };

test("defaults: off, UP, one octave, RATE at the middle", () => {
  assert.deepEqual({ ...DEFAULT_ARPEGGIO }, { version: 1, on: false, mode: "UP", range: 1, rate: 64 });
  assert.ok(Object.isFrozen(DEFAULT_ARPEGGIO));
});

test("readArpeggio returns a frozen copy", () => {
  const a = readArpeggio(ok);
  assert.deepEqual({ ...a }, ok);
  assert.ok(Object.isFrozen(a));
  assert.notEqual(a, ok);
});

test("readArpeggio refuses each bad field, naming it", () => {
  const bad: [Record<string, unknown>, RegExp][] = [
    [{ ...ok, version: 2 }, /version/],
    [{ ...ok, on: 1 }, /on must/],
    [{ ...ok, mode: "RANDOM" }, /mode/],
    [{ ...ok, range: 4 }, /range/],
    [{ ...ok, rate: 128 }, /rate/],
    [{ ...ok, rate: 1.5 }, /rate/],
    [{ ...ok, hold: true }, /unknown field hold/],
  ];
  for (const [x, re] of bad) assert.throws(() => readArpeggio(x), re);
  const { range: _r, ...missing } = ok;
  assert.throws(() => readArpeggio(missing), /range/);
  assert.throws(() => readArpeggio(null), /object/);
});

test("refused settings keep the arpeggiator as it was", () => {
  const s = createOfflineSynth(48000);
  s.loadVoice(patch());
  s.loadArpeggio({ version: 1, on: true, mode: "UP", range: 1, rate: 64 });
  assert.throws(() => s.loadArpeggio({ ...ok, range: 4 } as never), /range/);
  s.noteOn(60); s.noteOn(64);
  const out = new Float32Array(4800);
  s.render(out);
  assert.equal(s.sounding(), 1); // still arpeggiating: one step at a time
});

test("the step rate rises from RATE 0 to 127", () => {
  for (let r = 1; r <= 127; r++) assert.ok(arpStepsPerSecond((r * 10) / 127) > arpStepsPerSecond(((r - 1) * 10) / 127), `rate ${r}`);
});
