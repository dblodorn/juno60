# @dblodorn/roland-juno60-engine

An approximate Roland Juno-60 emulator as a sound source: load a patch, play notes, in an AudioWorklet inside your
own `AudioContext` or offline in Node. It comes from the [Juno-60 editor](https://github.com/dblodorn/juno60) and has
the same shape as [`@dblodorn/yamaha-dx7-engine`](https://github.com/dblodorn/dx7/tree/main/packages/yamaha-dx7-engine)
and [`@dblodorn/casio-vz-engine`](https://github.com/dblodorn/vz10m/tree/main/packages/casio-vz-engine), so a host
can swap one for another.

It is an approximate stand-in for the Juno-60, made for hearing patches while editing and for learning, not a
replacement for the instrument. Envelope times, the LFO delay, the HPF and the chorus follow
[Andy Harman's measurements of a Juno-60](https://github.com/pendragon-andyh/Juno60) (MIT; see `NOTICE`); the rest
are estimates, marked in `src/engine/calibration.ts`.

## Install

The package is on GitHub Packages, which needs a token to install, even for public packages. Make a classic
personal access token with the `read:packages` scope, then add an `.npmrc` beside your `package.json`:

```
@dblodorn:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

```sh
GITHUB_TOKEN=ghp_… pnpm add @dblodorn/roland-juno60-engine
```

It ships as ES modules with TypeScript types. Nothing needs to be built or configured on your side.

## Play

```ts
import { createSynth } from "@dblodorn/roland-juno60-engine";

let ctx: AudioContext | undefined;
button.onclick = async () => {
  ctx ??= new AudioContext(); // create or resume it in a click
  await ctx.resume();
  const synth = await createSynth(ctx);
  synth.output.connect(ctx.destination);
  synth.loadVoice(patchBytes); // 42 bytes
  synth.noteOn(60);
  setTimeout(() => synth.noteOff(60), 1000);
};
```

- `loadVoice(bytes)` takes a 42-byte patch (see below) and throws on anything else. Notes already sounding take the
  new patch at once, as the Juno-60's live panel does.
- `noteOn(note, velocity?)`: the Juno-60 has no velocity, so velocity only matters as 0 (a note-off).
- `output` is stereo: the chorus is stereo.
- `createSynth(ctx, { workletUrl })` loads the worklet from a URL you serve (`@dblodorn/roland-juno60-engine/worklet.js`)
  instead of a Blob URL, for pages whose Content-Security-Policy refuses `blob:` scripts.
- `createOfflineSynth(sampleRate)` renders without Web Audio: `render(out)` (mono) or `renderStereo(left, right)`.

## The patch

The Juno-60 stores 56 patches but publishes no data format (it has no MIDI), so a patch here is this project's own
42 bytes: one byte per panel control in panel order, sliders 0–127 (shown 0–10), switches as small integers, then a
16-character name. `VOICE_FIELDS` lists every byte; `get`, `getName` and `displayOf` read them. The package has no
way to change a patch; the editor does that.
