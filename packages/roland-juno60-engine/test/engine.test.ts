import { test } from "node:test";
import assert from "node:assert/strict";
import { createOfflineSynth } from "../src/offline.ts";
import { attackSeconds, decaySeconds } from "../src/engine/calibration.ts";
import { patch, slider } from "./voices.ts";

const SR = 48000;
const peak = (a: Float32Array, from = 0, to = a.length): number => { let m = 0; for (let i = from; i < to; i++) m = Math.max(m, Math.abs(a[i]!)); return m; };
const rms = (a: Float32Array, from = 0, to = a.length): number => { let s = 0; for (let i = from; i < to; i++) s += a[i]! * a[i]!; return Math.sqrt(s / (to - from)); };

function play(values: Record<string, number>, seconds: number, note = 60, holdFor = seconds): Float32Array {
  const s = createOfflineSynth(SR);
  s.loadVoice(patch(values));
  s.noteOn(note);
  const out = new Float32Array(Math.round(seconds * SR));
  const hold = Math.min(out.length, Math.round(holdFor * SR));
  s.render(out, hold, 0);
  s.noteOff(note);
  if (hold < out.length) s.render(out, out.length - hold, hold);
  return out;
}

test("silent until a note, and with no patch", () => {
  const s = createOfflineSynth(SR);
  const out = new Float32Array(4800);
  s.noteOn(60); // no patch yet: ignored
  s.render(out);
  assert.equal(peak(out), 0);
  s.loadVoice(patch());
  s.render(out);
  assert.equal(peak(out), 0);
});

test("a saw at 8' plays middle C at its pitch, at a sensible level", () => {
  const out = play({}, 0.5);
  const p = peak(out, 4800);
  assert.ok(p > 0.15 && p < 0.6, `peak ${p}`);
  // count upward zero crossings over 0.4 s
  let n = 0;
  for (let i = 4801; i < 24000; i++) if (out[i - 1]! < 0 && out[i]! >= 0) n++;
  const hz = n / ((24000 - 4801) / SR);
  assert.ok(Math.abs(hz - 261.63) < 4, `pitch ${hz}`);
});

test("RANGE 16' and 4' move the pitch an octave", () => {
  const count = (out: Float32Array) => { let n = 0; for (let i = 4801; i < 24000; i++) if (out[i - 1]! < 0 && out[i]! >= 0) n++; return n; };
  const mid = count(play({ range: 1 }, 0.5)), low = count(play({ range: 0 }, 0.5)), high = count(play({ range: 2 }, 0.5));
  assert.ok(Math.abs(low * 2 - mid) <= 2 && Math.abs(high - mid * 2) <= 3, `${low} ${mid} ${high}`);
});

test("attack takes the measured time (slider 5: about 0.24 s)", () => {
  const out = play({ envA: slider(5) }, 0.6);
  const top = peak(out);
  let at = 0;
  for (let i = 0; i < out.length; i += 48) if (peak(out, i, i + 480) >= top * 0.95) { at = i / SR; break; }
  const want = attackSeconds(5);
  assert.ok(Math.abs(at - want) < 0.06, `reached full level at ${at}s, expected about ${want}s`);
});

test("release falls to silence within its time and frees the voice", () => {
  const s = createOfflineSynth(SR);
  s.loadVoice(patch({ envR: slider(5) }));
  s.noteOn(60);
  const out = new Float32Array(SR * 2);
  s.render(out, SR / 10, 0);
  s.noteOff(60);
  s.render(out, out.length - SR / 10, SR / 10);
  const end = Math.round((0.1 + decaySeconds(5) + 0.05) * SR);
  assert.ok(peak(out, end, end + 4800) < 1e-4, "still sounding after the release time");
  assert.equal(s.sounding(), 0);
});

test("VCA GATE stops within milliseconds even with a long release", () => {
  const out = play({ vcaMode: 1, envR: 127 }, 0.3, 60, 0.1);
  assert.ok(peak(out, Math.round(0.13 * SR)) < 1e-3);
});

test("the filter darkens: FREQ low is quieter in the highs than FREQ 10", () => {
  const open = play({ vcfFreq: 127 }, 0.3), shut = play({ vcfFreq: slider(3) }, 0.3);
  assert.ok(rms(shut, 4800) < rms(open, 4800) * 0.6);
});

test("resonance at 10 rings on its own with no oscillator", () => {
  const out = play({ saw: 0, vcfRes: 127, vcfFreq: slider(5), dcoNoise: 1 }, 1);
  assert.ok(rms(out, SR / 2) > 0.01, `rms ${rms(out, SR / 2)}`);
});

test("HPF 3 takes the body out of a 16' saw", () => {
  const flat = play({ range: 0 }, 0.3), cut = play({ range: 0, hpf: 3 }, 0.3);
  assert.ok(rms(cut, 4800) < rms(flat, 4800) * 0.8);
});

test("chorus I makes left and right differ; off, they are the same", () => {
  for (const [chorus, differs] of [[0, false], [1, true], [3, false]] as const) {
    const s = createOfflineSynth(SR);
    s.loadVoice(patch({ chorus }));
    s.noteOn(60);
    const l = new Float32Array(SR / 2), r = new Float32Array(SR / 2);
    s.renderStereo(l, r);
    let d = 0;
    for (let i = 0; i < l.length; i++) d = Math.max(d, Math.abs(l[i]! - r[i]!));
    assert.equal(d > 1e-3, differs, `chorus ${chorus}: max difference ${d}`);
  }
});

test("six voices: a seventh note steals the oldest", () => {
  const s = createOfflineSynth(SR);
  s.loadVoice(patch());
  for (let n = 60; n < 67; n++) s.noteOn(n);
  assert.equal(s.sounding(), 6);
});

test("PWM, sub and noise each add to the sound", () => {
  const base = rms(play({ saw: 0, pulse: 1 }, 0.3), 4800);
  assert.ok(base > 0.05);
  assert.ok(rms(play({ saw: 0, sub: 1, dcoSub: 127 }, 0.3), 4800) > 0.05);
  assert.ok(rms(play({ saw: 0, dcoNoise: 127 }, 0.3), 4800) > 0.01);
});

test("LFO delay: no vibrato before the delay, vibrato after", () => {
  // DCO LFO full, delay 5 (0.85 s silent): the pitch is steady in the first half second
  const out = play({ dcoLfo: 127, lfoRate: slider(6), lfoDelay: slider(5) }, 2);
  const periods = (from: number, to: number) => {
    const xs: number[] = [];
    for (let i = from + 1; i < to; i++) if (out[i - 1]! < 0 && out[i]! >= 0) xs.push(i);
    const d = xs.slice(1).map((x, i) => x - xs[i]!);
    return Math.max(...d) - Math.min(...d);
  };
  assert.ok(periods(4800, SR / 2) <= 2, "pitch moved during the delay");
  assert.ok(periods(Math.round(1.3 * SR), 2 * SR) > 4, "no vibrato after the delay");
});
