#!/usr/bin/env node
// Install the package the way a consumer gets it and use it: `pnpm pack` (which applies publishConfig, so the
// exports point at dist/), install the tarball into a scratch project outside the workspace, type-check a
// consumer file against the shipped declarations (strict, no .ts imports allowed, lib checks on), then render a
// note and import the worklet file. Fails loudly on a broken exports map, a missing .js extension or a missing
// worklet. Run after `pnpm build`; CI runs it before publishing.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { patch } from "../test/voices.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const name = (JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as { name: string }).name;
const dir = mkdtempSync(path.join(tmpdir(), "roland-juno60-engine-smoke-"));
const run = (cmd: string, args: string[], cwd = dir) => execFileSync(cmd, args, { cwd, stdio: ["ignore", "pipe", "inherit"], encoding: "utf8" });

try {
  const tgz = run("pnpm", ["pack", "--pack-destination", dir], root).trim().split("\n").pop()!;
  writeFileSync(path.join(dir, "voice.bin"), patch());
  writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "smoke", private: true, type: "module", dependencies: { [name]: `file:${tgz}` } }));
  run("npm", ["install", "--no-audit", "--no-fund", "--ignore-scripts", "--loglevel=error"]);

  const exports = (JSON.parse(readFileSync(path.join(dir, "node_modules", name, "package.json"), "utf8")) as { exports: Record<string, unknown> }).exports;
  if (JSON.stringify(exports).includes("src/")) throw new Error(`the packed exports still point at src/: ${JSON.stringify(exports)}`);

  // types, as a strict consumer sees them
  writeFileSync(path.join(dir, "consumer.ts"), `
import { createOfflineSynth, createSynth, DEFAULT_ARPEGGIO, readArpeggio, readVoice, VOICE_BYTES, type Arpeggio, type PatchSource, type Synth } from "${name}";
const s = createOfflineSynth(48000);
s.loadVoice(readVoice(new Uint8Array(VOICE_BYTES)));
const arp: Arpeggio = readArpeggio({ ...DEFAULT_ARPEGGIO, on: true });
s.loadArpeggio(arp);
s.setHold(false);
const lib: PatchSource = { list: async () => ({ items: [], next: null }), get: async () => new Uint8Array(VOICE_BYTES) };
const later: (ctx: BaseAudioContext) => Promise<Synth> = ctx => createSynth(ctx, { workletUrl: "/worklet.js" });
export { lib, later };
`);
  writeFileSync(path.join(dir, "tsconfig.json"), JSON.stringify({
    compilerOptions: { strict: true, noEmit: true, skipLibCheck: false, module: "nodenext", moduleResolution: "nodenext", target: "es2022", lib: ["dom", "es2022"], types: [] },
    files: ["consumer.ts"],
  }));
  run(path.join(root, "node_modules/.bin/tsc"), ["-p", "."]);

  // runtime: render a note, and the worklet file is importable as a separate export
  writeFileSync(path.join(dir, "play.mjs"), `
import { readFileSync } from "node:fs";
import { createOfflineSynth } from "${name}";
const voice = new Uint8Array(readFileSync("voice.bin"));
const s = createOfflineSynth(48000);
s.loadVoice(voice);
s.noteOn(60, 100);
const out = new Float32Array(24000);
s.render(out);
const peak = out.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
if (!(peak > 0.05)) throw new Error("silent render, peak " + peak);
const worklet = import.meta.resolve("${name}/worklet.js");
if (!readFileSync(new URL(worklet), "utf8").includes("registerProcessor")) throw new Error("worklet.js is not the worklet");
// an arpeggio: one voice at a time
const a = createOfflineSynth(48000);
a.loadVoice(voice);
a.loadArpeggio({ version: 1, on: true, mode: "UP", range: 2, rate: 100 });
a.noteOn(60); a.noteOn(64); a.noteOn(67);
const out2 = new Float32Array(48000);
a.render(out2);
if (a.sounding() < 1 || a.sounding() > 2) throw new Error("the arpeggio should sound one step (and a release tail), got " + a.sounding());
console.log("saw patch: peak " + peak.toFixed(3) + ", arpeggio ok, worklet.js ok");
`);
  process.stdout.write(`smoke (${path.basename(tgz)}): ${run("node", ["play.mjs"])}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
