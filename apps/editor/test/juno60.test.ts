import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_ARPEGGIO, fromFile, get, getName, initPatch, initVoice, readVoice, set, setArpeggio, setName, toFile, VOICE_BYTES,
} from "../lib/juno60/codec.ts";

test("INIT is a valid patch named INIT", () => {
  const p = initVoice();
  assert.equal(p.length, VOICE_BYTES);
  assert.deepEqual(readVoice(p), p);
  assert.equal(getName(p), "INIT");
  assert.equal(get(p, "saw"), 1);
});

test("set changes one byte, clamped, and leaves the original alone", () => {
  const p = initVoice();
  const q = set(p, "vcfRes", 200);
  assert.equal(get(q, "vcfRes"), 127);
  assert.equal(get(p, "vcfRes"), 0);
  assert.equal(q.filter((b, i) => b !== p[i]).length, 1);
  assert.equal(get(set(p, "chorus", 9), "chorus"), 3);
});

test("names are upper case printable ASCII, 16 long", () => {
  assert.equal(getName(setName(initVoice(), "warm pad é and more text")), "WARM PAD   AND M");
});

test("JSON files round-trip and refuse bad values", () => {
  const a = { data: setName(set(initVoice(), "chorus", 2), "STRINGS"), arpeggio: setArpeggio(DEFAULT_ARPEGGIO, { on: true, mode: "UP_DOWN", range: 3, rate: 100 }) };
  const b = { data: set(initVoice(), "hpf", 3), arpeggio: DEFAULT_ARPEGGIO };
  const text = toFile([a, b]);
  assert.equal(JSON.parse(text).version, 2);
  assert.equal(JSON.parse(text).patches[1].arpeggio, undefined); // the default is left out
  const back = fromFile(text);
  assert.deepEqual(back.map(p => p.data), [a.data, b.data]);
  assert.deepEqual(back.map(p => ({ ...p.arpeggio })), [{ ...a.arpeggio }, { ...b.arpeggio }]);
  assert.throws(() => fromFile("nope"), /NOT A JSON FILE/);
  assert.throws(() => fromFile(JSON.stringify({ format: "other" })), /NOT A JUNO-60/);
  assert.throws(() => fromFile(JSON.stringify({ format: "dmbk-juno60-patches", version: 1, patches: [{ name: "X", values: { chorus: 7 } }] })), /CHORUS CHORUS IS 7/);
  // missing values take INIT's
  assert.equal(get(fromFile(JSON.stringify({ format: "dmbk-juno60-patches", version: 1, patches: [{ name: "X", values: { vcfFreq: 10 } }] }))[0]!.data, "saw"), 1);
  assert.throws(() => fromFile(JSON.stringify({ format: "dmbk-juno60-patches", version: 2, patches: [{ name: "X", values: {}, arpeggio: { ...DEFAULT_ARPEGGIO, range: 4 } }] })), /PATCH 1: .*RANGE/);
});

test("a version 1 file opens with the arpeggiator off", () => {
  const [p] = fromFile(JSON.stringify({ format: "dmbk-juno60-patches", version: 1, patches: [{ name: "OLD", values: { chorus: 1 } }] }));
  assert.equal(getName(p!.data), "OLD");
  assert.deepEqual({ ...p!.arpeggio }, { ...DEFAULT_ARPEGGIO });
});

test("arpeggiator edits leave the 42 sound bytes alone", () => {
  const p = initPatch();
  const q = { data: p.data, arpeggio: setArpeggio(p.arpeggio, { on: true, mode: "DOWN", range: 2, rate: 10 }) };
  assert.deepEqual(q.data, initVoice());
  assert.equal(q.arpeggio.mode, "DOWN");
  assert.throws(() => setArpeggio(p.arpeggio, { range: 5 as never }), /range/);
});
