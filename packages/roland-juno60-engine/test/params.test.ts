import { test } from "node:test";
import assert from "node:assert/strict";
import { NAME_BYTE, PATCH_NUMBERS, VOICE_BYTES, VOICE_FIELDS, voiceField, toPanel } from "../src/params.ts";

test("every field has its own byte, before the name", () => {
  const bytes = VOICE_FIELDS.map(f => f.byte).sort((a, b) => a - b);
  assert.deepEqual(bytes, Array.from({ length: NAME_BYTE }, (_, i) => i));
  assert.equal(VOICE_BYTES, 42);
});

test("keys are unique and look-ups throw on unknown keys", () => {
  assert.equal(new Set(VOICE_FIELDS.map(f => f.key)).size, VOICE_FIELDS.length);
  assert.throws(() => voiceField("nope"), /No Juno-60 field/);
});

test("panel readings: sliders 0–10, VCA LEVEL −5…+5", () => {
  assert.equal(toPanel(127), 10);
  assert.equal(voiceField("vcfFreq").display!(127), "10.0");
  assert.equal(voiceField("vcaLevel").display!(0), "-5.0");
  assert.equal(voiceField("vcaLevel").display!(64), "0.0");
  assert.equal(voiceField("vcaLevel").display!(127), "+5.0");
});

test("56 patch numbers, 11 to 78", () => {
  assert.equal(PATCH_NUMBERS.length, 56);
  assert.equal(PATCH_NUMBERS[0], 11);
  assert.equal(PATCH_NUMBERS[55], 78);
  assert.ok(!PATCH_NUMBERS.some(n => n % 10 === 0 || n % 10 === 9));
});
