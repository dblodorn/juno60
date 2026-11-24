import { test } from "node:test";
import assert from "node:assert/strict";
import { displayOf, get, getName, readVoice } from "../src/codec.ts";
import { patch } from "./voices.ts";

test("reads fields and the name", () => {
  const p = patch({ chorus: 2, vcfFreq: 64 }, "BRASS 1");
  assert.equal(get(p, "chorus"), 2);
  assert.equal(displayOf(p, "chorus"), "II");
  assert.equal(displayOf(p, "vcfFreq"), "5.0");
  assert.equal(getName(p), "BRASS 1");
});

test("readVoice copies a good patch and refuses bad ones", () => {
  const p = patch();
  const c = readVoice(p);
  assert.notEqual(c, p);
  assert.deepEqual(c, p);
  assert.throws(() => readVoice(new Uint8Array(41)), /42 bytes/);
  assert.throws(() => readVoice(patch({ chorus: 4 })), /CHORUS CHORUS \(byte 24\) must be 0–3/);
  assert.throws(() => readVoice(patch({ vcfRes: 128 })), /RES/);
});
