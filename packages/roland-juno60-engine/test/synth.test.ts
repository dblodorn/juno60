import { test } from "node:test";
import assert from "node:assert/strict";
import code from "../src/worklet/code.generated.ts";
import { PROCESSOR } from "../src/worklet/messages.ts";
import * as pkg from "../src/index.ts";

test("the worklet code registers the processor", () => {
  assert.ok(code.includes("registerProcessor"));
  assert.ok(code.includes(PROCESSOR));
});

test("importing the package touches no browser globals", () => {
  assert.equal(typeof pkg.createSynth, "function");
  assert.equal(typeof pkg.createOfflineSynth, "function");
  assert.equal(pkg.VOICE_BYTES, 42);
});

test("offline synth refuses bad input without changing what plays", () => {
  const s = pkg.createOfflineSynth(48000);
  assert.throws(() => s.noteOn(128), /Note/);
  assert.throws(() => s.loadVoice(new Uint8Array(3)), /42 bytes/);
  assert.throws(() => pkg.createOfflineSynth(0), /Sample rate/);
});
