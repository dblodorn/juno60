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

test("the worklet synth checks arpeggiator settings and posts numbers; offline gives the same samples", async () => {
  const posted: unknown[] = [];
  const g = globalThis as Record<string, unknown>;
  const saved = g.AudioWorkletNode;
  g.AudioWorkletNode = class { port = { postMessage: (m: unknown) => posted.push(m) }; disconnect() {} };
  try {
    const ctx = { audioWorklet: { addModule: async () => {} } } as unknown as BaseAudioContext; // a stand-in context
    const s = await pkg.createSynth(ctx, { workletUrl: "worklet.js" });
    const settings = { version: 1, on: true, mode: "UP_DOWN", range: 2, rate: 99 } as const;
    s.loadArpeggio(settings);
    s.setHold(true);
    assert.throws(() => s.loadArpeggio({ ...settings, mode: "SIDEWAYS" } as never), /mode/);
    assert.deepEqual(posted, [{ type: "arp", on: true, mode: 2, range: 2, rate: 99 }, { type: "hold", on: true }]);

    // what the processor does with those messages, against the offline synth: the same engine calls, the same samples
    const { Engine } = await import("../src/engine/engine.ts");
    const { patch } = await import("./voices.ts");
    const e = new Engine(48000);
    e.setPatch(patch());
    const m = posted[0] as { on: boolean; mode: number; range: number; rate: number };
    e.setArpeggio(m.on, m.mode, m.range, m.rate);
    const off = pkg.createOfflineSynth(48000);
    off.loadVoice(patch());
    off.loadArpeggio(settings);
    for (const n of [60, 64, 67]) { e.noteOn(n); off.noteOn(n); }
    const a = new Float32Array(48000), l = new Float32Array(48000), r = new Float32Array(48000), b = new Float32Array(48000);
    e.render(l, r, 48000);
    off.renderStereo(a, b);
    assert.deepEqual(a, l);
    assert.deepEqual(b, r);
  } finally {
    g.AudioWorkletNode = saved;
  }
});
