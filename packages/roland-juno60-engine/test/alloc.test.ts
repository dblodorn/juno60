// In its own file, so it runs in a fresh process: after the other tests have driven every branch of the render
// code, V8 may still be re-optimising it, and the heap would grow for reasons that aren't render's.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createOfflineSynth } from "../src/offline.ts";
import { patch } from "./voices.ts";

const SR = 48000;

test("render never allocates", () => {
  const gc = (globalThis as { gc?: () => void }).gc;
  if (!gc) return;
  const s = createOfflineSynth(SR);
  s.loadVoice(patch({ chorus: 2, pulse: 1, sub: 1, dcoSub: 100, dcoNoise: 40, vcfRes: 90, hpf: 2 }));
  for (let n = 60; n < 66; n++) s.noteOn(n);
  const l = new Float32Array(128), r = new Float32Array(128);
  for (let i = 0; i < 3000; i++) s.renderStereo(l, r); // warm up and optimise
  gc();
  const before = process.memoryUsage().heapUsed;
  for (let i = 0; i < 1000; i++) s.renderStereo(l, r);
  const grew = process.memoryUsage().heapUsed - before;
  assert.ok(grew < 64 * 1024, `heap grew ${grew} bytes`);
});
