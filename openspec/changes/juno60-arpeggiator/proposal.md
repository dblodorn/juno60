# Proposal

## Why

The Juno-60's arpeggiator is one of the things it is known for, and the editor and emulator don't have it yet
(issue #4). Players also want an arpeggio to belong to a sound: open a patch, or pick it in windchime, and it plays
the way it was set up. The hardware never stored arpeggiator settings in its patches, so this project adds that as
its own section beside the patch. The 42 sound bytes stay as they are, and so does every patch already saved.

## What Changes

- **The arpeggiator in the engine** (`@dblodorn/roland-juno60-engine`): it works like the hardware's.
  - ARPEGGIO on/off; MODE UP, DOWN or UP&DOWN; RANGE 1, 2 or 3 octaves; a RATE slider; HOLD.
  - It plays the held notes in pitch order. The timing runs inside the AudioWorklet, so it stays steady when the page is busy.
  - It's in the engine package rather than the editor, so windchime gets the same arpeggiator from the same package.
  - The engine gets a minor version bump.
- **The arpeggiator settings, a section of their own:** ON, MODE, RANGE and RATE, in a small versioned shape next to the patch, not inside its 42 bytes.
  - A patch without the section plays as it does today, with the arpeggiator off.
  - HOLD is a performance switch, so it isn't saved.
  - The engine loads the section separately from the patch: `loadArpeggio()`, beside `loadVoice()`.
- **The editor:**
  - An ARPEGGIO panel section in the hardware's place.
  - The settings are saved with each patch in LOCAL and SHARED.
  - Patch files move to version 2, with an optional `arpeggio` per patch. Version 1 files still open.
- **Carry-over to windchime:** a windchime unit on ROLAND JUNO-60 whose patch has the arpeggiator on arpeggiates its strikes.
  - How strikes become held notes (each strike holds its note for DECAY) is settled in design.
- **Not breaking:** the 42-byte patch format, the `data` field, `SynthPatch` and windchime's share links and saved compositions are unchanged.

## Capabilities

### New Capabilities

- `juno60-arpeggiator`: the arpeggiator's behaviour.
  - Modes, range, rate scale, note order, HOLD, and what happens on patch change and all-notes-off.
  - The arpeggiator settings shape: its fields, ranges, version, defaults, and its JSON form in files and in the API.

### Modified Capabilities

- `juno60-engine`: the synth gains `loadArpeggio()` and arpeggiated playback, and `render()` must still never allocate while arpeggiating.
- `juno60-editor`:
  - The panel gains the ARPEGGIO section.
  - LOCAL and SHARED save the arpeggiator settings with each patch.
  - Patch files move to version 2 and keep reading version 1.

## Impact

- **juno60:**
  - `packages/roland-juno60-engine`: a new `arpeggio.ts` (shape and codec), the arpeggiator in `engine/`, synth and offline APIs, `calibration.ts` (the RATE curve, labelled MEASURED or ESTIMATE), tests, a minor release.
  - `apps/editor`: Editor panel, store, `lib/juno60/codec.ts` file format, SHARED save and update, help, changelog.
- **dmbk-graphql-api** (its own change and PR, deployed before the editor):
  - `Juno60Voice` gains an optional `arpeggio` field, separate from `data`, with matching save and update inputs.
  - The `juno60_voices` validator, and its spec `juno60-voices`.
  - Existing documents need no migration.
- **windchime** (its own change and PR, after the engine release):
  - Bump the engine.
  - `lib/patches.ts` fetches `arpeggio` for Juno-60 patches.
  - The external-synth path calls `loadArpeggio`.
  - A changelog line.
  - Links and saves are unchanged, since the arpeggiator settings travel with the patch, not the unit.
- **Credit:** the arpeggiator's behaviour comes from the Juno-60 owner's manual and service notes, plus JunoX as a reference only (GPL, no code). COLOPHON PRIOR WORK names its sources.
