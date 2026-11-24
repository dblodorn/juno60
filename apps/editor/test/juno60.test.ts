import { test } from "node:test";
import assert from "node:assert/strict";
import { fromFile, get, getName, initVoice, readVoice, set, setName, toFile, VOICE_BYTES } from "../lib/juno60/codec.ts";

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
  const a = setName(set(initVoice(), "chorus", 2), "STRINGS"), b = set(initVoice(), "hpf", 3);
  const back = fromFile(toFile([a, b]));
  assert.deepEqual(back, [a, b]);
  assert.throws(() => fromFile("nope"), /NOT A JSON FILE/);
  assert.throws(() => fromFile(JSON.stringify({ format: "other" })), /NOT A JUNO-60/);
  assert.throws(() => fromFile(JSON.stringify({ format: "dmbk-juno60-patches", version: 1, patches: [{ name: "X", values: { chorus: 7 } }] })), /CHORUS CHORUS IS 7/);
  // missing values take INIT's
  assert.equal(get(fromFile(JSON.stringify({ format: "dmbk-juno60-patches", version: 1, patches: [{ name: "X", values: { vcfFreq: 10 } }] }))[0]!, "saw"), 1);
});
