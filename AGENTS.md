# Juno-60 editor and engine

A browser editor and librarian for Roland Juno-60 patches, with an approximate emulator to hear them, published as
a package (`@dblodorn/roland-juno60-engine`) that other apps (windchime) use as a sound source. Sibling of
`~/Desktop/sound/dx7` and `~/Desktop/sound/vz10m`: same workspace shape, same stack, same UI rules, same
engine-package convention (`openspec/specs/engine-packages`). The editor started from the sound design system's
starter (`templates/sound-app`). When this file doesn't say how something is done, do it the way dx7's `CLAUDE.md`
says.

**The emulator is an approximate stand-in.** The editor, the library and learning the Juno-60 are the point. ABOUT
(LIBRARY → COLOPHON), the SOUND (?) note and every README say so. Never call the emulator accurate or authentic.

**No hardware link (yet).** A stock Juno-60 has no MIDI: it has Roland's DCB port and saves patches to cassette. The
editor plays the emulator only, and MIDI IN plays the emulator from a controller. Cassette dumps and MIDI retrofit
kits (Tubbutec Juno-66) are GitHub issues, each its own later change.

## Commands

Run from the root; they fan out to the workspace (`pnpm -F <name> <script>` for one package).

- `pnpm dev`, `pnpm build`: the editor. Both build the engine's worklet first (`pnpm -F juno60-editor engine`).
- `pnpm test`: every package's `test/*.test.ts` through `node --test`. The engine's `alloc.test.ts` checks render
  never allocates and stays in its own file (a fresh process).
- `pnpm typecheck`: `tsc --noEmit` in each package. `pnpm build` type-checks too.
- Engine package (`pnpm -F @dblodorn/roland-juno60-engine …`): `build:worklet`, `build` (writes `dist/`), `smoke`.
- Don't run `pnpm build` while `pnpm dev` is running (it overwrites `.next`).

## Layout

- `packages/roland-juno60-engine`: the read side and the player. Nothing in it writes a patch.
  - `src/params.ts`: the one field table. A patch is 42 bytes in **this project's own layout** (the Juno-60
    publishes no format): one byte per panel control in panel order (LFO, DCO, HPF, VCF, VCA, ENV, CHORUS), sliders
    0–127 shown 0–10 (VCA LEVEL −5…+5), switches as small integers, then a 16-character name at 26. Sources are cited
    at the top of the file; the owner's manual hasn't been read for it yet, so the PWM MODE order (ENV, MAN, LFO,
    from Roland's spec listing as quoted by a search) is unverified.
  - `src/codec.ts`: `get`, `getName`, `displayOf`, `readVoice` (checks length and ranges).
  - `src/engine/`: written for this package. `calibration.ts` is the one file of numbers, each labelled MEASURED
    (ported from Andy Harman's Juno-60 analysis, MIT; `NOTICE`), PANEL or ESTIMATE. Changing one changes the sound:
    release at least a minor version with a changelog line.
    - `voice.ts`: DCO (phase counter, PolyBLEP saw, pulse with PWM from ENV/MAN/LFO, sub square, 5 kHz low-passed
      noise) → 4-pole ZDF ladder VCF with a tanh input → VCA (ENV or GATE).
    - `env.ts` (the measured RC curves), `lfo.ts` (one triangle LFO with the measured delay), `effects.ts` (the
      shared HPF and the BBD chorus I, II, I+II), `engine.ts` (six voices, assigned in turn).
    - `patch.ts` decodes a patch once into a `Float64Array`; render reads only typed arrays, and numbers cross
      non-inlined calls through typed arrays (an argument or return value would be boxed). `render()` must never
      allocate.
    - A new patch applies at once to sounding notes (the Juno-60's panel is live), unlike the DX7 engine.
  - `src/synth.ts` (AudioWorklet, stereo out), `src/offline.ts` (`render` mono, `renderStereo`), `src/worklet/`
    (the processor `roland-juno60-engine`), `src/sources/patch-source.ts`, `scripts/`, `test/voices.ts`.
  - Workspace `exports["."]` is `src/index.ts`; `publishConfig.exports` swaps in `dist/`.
  - To release: bump `package.json`, add a dated `CHANGELOG.md` section, merge, push the tag
    `roland-juno60-engine@<version>` on `main`. The workflow publishes (it installs only the engine's dependencies);
    never publish by hand.
- `apps/editor`: the Next.js app (package `juno60-editor`).
  - `lib/juno60/codec.ts`: the write side, re-exporting the read side: `set`/`setMany` (clamp, one byte each),
    `setName`, `initVoice` (this editor's INIT: a plain saw, filter open, organ envelope), `toFile`/`fromFile`
    (`.json` patch files: named panel values, `format: "dmbk-juno60-patches"`, `version: 1`). Tests in `test/`.
  - `components/Editor.tsx`: the history reducer, SOUND, KEYS, AUDIO, MIDI IN, the panel. `PANEL` lists the sections
    in the Juno-60's order; PULSE/SAW/SUB draw as checkboxes, HPF as a four-position slider, CHORUS as the two
    buttons I and II (the value is their bits: 1 I, 2 II, 3 I+II).
  - `components/Library.tsx`: LOCAL (save, open, delete, search, `.json` in and out) and COLOPHON.
  - `lib/audio.ts`, `lib/store.ts` (`juno60.*`): from dx7. `lib/router.ts`: held-key counting for KEYS, the
    computer keys and MIDI IN. `lib/midi.ts`: MIDI IN only, notes only, no SysEx, access on the CONNECT click.
  - `lib/help.ts`: the (?) notes, written to teach; each says where the emulator estimates. `lib/colophon.ts`.
  - The interface comes from `@dblodorn/sound-ui` and `@dblodorn/sound-tokens` (pinned exactly, GitHub Packages;
    `.npmrc` holds only the registry line; `NPM_RC` on Vercel, as in dx7).
- Deploy: Vercel project `juno60` (team `db13`), root directory `apps/editor`; every push to `main` goes to production
  at `https://juno60.dmbk.io`. DNS: `juno60` CNAME on DigitalOcean.

## Decisions already made

- **One repo, `dblodorn/juno60`** (public): the editor at `apps/editor`, the engine at `packages/roland-juno60-engine`.
- **Emulation source:** written fresh. Andy Harman's Juno-60 analysis (MIT) is ported with a `NOTICE`.
  **Never copy code from JunoX (GPL-3.0)**; it may serve as a reference and a test oracle (outputs compared) and is
  credited. TAL-U-NO-LX is a commercial plugin, linked as a resource only.
- **Factory patches** (Roland's 56): not included. Whether to seed them into the shared library is the user's call
  (Roland is still in business), as with the DX7's ROM cards.
- **Names:** synth id `roland-juno60`, menu name `ROLAND JUNO-60`, localStorage prefix `juno60.*`.

## Constraints

- TypeScript, strict, `noUncheckedIndexedAccess`, `erasableSyntaxOnly`, explicit `.ts` imports; tests with `node --test`.
- Bytes are the source of truth: edits go through `set()` and touch only that field; never rebuild a patch from values.
- Don't guess facts about the instrument: cite a source; flag what's unverified.
- SSR-safe modules; audio starts inside a click; MIDI access only on a click.
- **COLOPHON** (`lib/colophon.ts`): the typeface's credit first (TYPE: KNIF MONO BY A IS FOR FONTS; Knif Mono's webfont
  EULA asks for it), then SOUND DESIGN SYSTEM, then ABOUT, then **PRIOR WORK: every project, analysis or reference the
  code or the sound draws on, credited even where no code was copied** (a change that adds a source adds its entry),
  then RESOURCES.
- The 1-bit UI language from the design system; a control the package lacks goes into the package.
- Changelog line for every shipped editor change (`lib/changelog.ts`); package releases get a `CHANGELOG.md` entry.
- Features go through OpenSpec changes and are archived when done.
