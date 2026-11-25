# Design

## Context

- **The engine today:** `Engine` takes `noteOn`/`noteOff` straight to six round-robin voices, and renders in fixed
  blocks without allocating.
  - The AudioWorklet synth (`synth.ts`) checks everything on the main thread and posts small messages to the worklet.
  - The offline synth drives the same `Engine` directly.
- **Patches:** a patch is 42 bytes, `readVoice()` is the only gate, and the API's `Juno60Voice.data` is exactly those bytes. VZ, DX7 and Juno-60 patch types are told apart by the length of `data`.
- **The editor's library:** LOCAL stores the patch bytes per entry, and SHARED saves and updates through the persisted-operation route.
- **windchime:** an external synth gets `noteOff` then `noteOn` on each strike, and a timer sends `noteOff` after DECAY. Patches come from `lib/patches.ts` through `SynthPatch` (`id name data`).
- See proposal.md for why, and the specs for the behaviour required.

## Goals / Non-Goals

**Goals:**
- One arpeggiator implementation, in the engine, giving the same steps in the worklet, offline and in windchime.
- Arpeggiator settings that travel beside the patch everywhere: engine, file, API, windchime. They never touch `data` or the 42 bytes.

**Non-Goals:**
- External clock or sync: the Juno-60's CLOCK IN, DCB, and MIDI clock.
- Arpeggio in windchime's share links or saved compositions: the settings travel with the patch, not the unit.
- Any arpeggiator for the VZ-10M or DX7.
- Reading arpeggiator settings from cassette dumps. The hardware doesn't store them.

## Decisions

### 1. The arpeggiator runs inside `Engine`, on the audio thread
An `Arp` sits between the note calls and the voices.
- `noteOn`/`noteOff` update its held set, and the arpeggiator decides which voice notes to start and stop.
- `render()` splits its block at step boundaries, so a step starts on its exact sample.
- The offline synth and the worklet share it, so they give identical steps.

**Alternative:** stepping from the main thread with timers, or with `AudioContext.currentTime` scheduling. Rejected: timers jitter, and every host (the editor and windchime) would need its own copy.

### 2. Allocation-free state
- The held set is a 128-entry `Uint8Array` of flags plus a sorted `Int16Array` of held notes, rebuilt only when a key changes.
- The step position and the sample counter live in typed arrays, as the rest of the engine's state does.
- Sequences are computed per step from the sorted array, range and mode, never stored as arrays.

This keeps the existing heap test meaningful.

### 3. Settings are a separate, validated object
- **The checker:** `readArpeggio(x)` in the package checks the spec's shape and returns a frozen
  `{ version, on, mode, range, rate }`, or throws naming the field. It is the one gate, as `readVoice` is for bytes.
- **Loading:** the synths gain `loadArpeggio(settings)` and `setHold(on)`. The worklet receives an `arp` message carrying numbers.
- **Packing for the engine:** the engine stores the settings in a small `Float64Array`. Mode becomes 0–2, and rate is converted to step samples at load.
- **Defaults:** a constant `DEFAULT_ARPEGGIO`.

**Alternative:** appending bytes to the 42-byte patch. Rejected. It would change `data`'s length, which the API uses to tell patch types apart. It would also break every 42-byte reader and mix performance settings into the sound, which the request rules out.

### 4. Step timing and gate
- **Steps:** a step lasts `stepSamples(rate)`, an exponential curve between two ends in `calibration.ts`. Both are ESTIMATE until measured; see Open Questions.
- **Gate:** each step's note is released at `ARP_GATE` (ESTIMATE, 0.5) of the step. The voice's own envelope release then overlaps the next step, as on the hardware.
- **Voices:** the arpeggiator uses the normal round-robin voices, so release tails don't cut each other.
- **Live changes:** a rate change applies from the next step.

### 5. Held-note and HOLD rules live in the arpeggiator, not in hosts
- **Physical keys:** the `Arp` tracks physically held keys separately from latched ones.
- **With HOLD:** the first note-on after every key was released clears the latched set.
- **HOLD off:** the latched set drops to the physical keys.
- **Hosts:** the editor's KEYS, computer keys and MIDI IN only call `noteOn`/`noteOff`/`setHold`.

### 6. Editor storage and files
- **LOCAL:** entries become `{ data, arpeggio? }`. Records stored before this load with no `arpeggio`, which means off.
- **Undo:** the undo history covers both the patch and its arpeggiator settings.
- **Files:** version 2 adds an optional `arpeggio` per patch, in the spec's JSON form. The importer accepts versions 1 and 2.
- **The panel:** an ARPEGGIO section first, as on the hardware, with ON, MODE (UP / U&D / DOWN, three buttons), RANGE (1 / 2 / 3), a RATE slider and HOLD.

### 7. API: an optional `arpeggio` field on `Juno60Voice`, not inside `data`
This is dmbk-graphql-api's own change.
- **The type:** `Juno60Voice.arpeggio: Juno60Arpeggio` (nullable), an object type with `version`, `on`, `mode` (enum `UP | DOWN | UP_DOWN`), `range` and `rate`.
- **Writing:** save and update take an optional `Juno60ArpeggioInput` and check it with the same rules.
- **Storage:** a subdocument, optional in the collection validator. Existing documents need no migration.
- **Duplicates:** the per-key duplicate check covers `data` plus `arpeggio`, so the same sound with two different arpeggios can both be kept.
- **Other types:** `SynthPatch` is unchanged, and windchime asks for `arpeggio` with an inline fragment on `Juno60Voice`.

**Alternative:** a separate `Juno60Arpeggio` library linked by id. Rejected: it's more to store, list and own, and users want the arpeggio to belong to the sound.

### 8. windchime: strikes are the held notes
windchime already holds each struck note for DECAY.
- With the arpeggiator on, a unit's ringing tubes become the held set, and the arpeggio runs over whatever is still ringing.
- No new timing code is needed in windchime. It only:
  - fetches `arpeggio` with the patch;
  - calls `loadArpeggio`, using the default when the patch has none or the unit is on INIT;
  - loads it again when the patch changes.
- **Re-strikes:** a re-strike's `noteOff` then `noteOn` drops the note and adds it back, so the note keeps its pitch-order place.
- **The registry:** `SynthLike` gains an optional `loadArpeggio`, so the VZ-10M and DX7 entries are untouched.

## Risks / Trade-offs

- **[The rate curve and gate are guesses]** → label them ESTIMATE in `calibration.ts`, and correct them as a minor release with a changelog line, as other calibrations are.
- **[Splitting blocks at step boundaries adds per-block work]** → at most a few splits per 128-sample block at the fastest rate. Check with the existing CPU measurement, which is about 1.2% of a core.
- **[UP_DOWN endpoint behaviour may differ from the hardware]** → it's specified, so a correction changes the spec and the engine together in a minor release.
- **[windchime's arpeggio over ringing tubes may play steadily at high WIND]** → that's the intended sound. Players who don't want it pick a patch with the arpeggiator off.
- **[An old editor or windchime reading a patch with `arpeggio`]** → the field is optional and unknown to old queries, so they ignore it and play the sound as before.

## Migration Plan

1. **Engine:** release `@dblodorn/roland-juno60-engine` 0.2.0, with the arpeggiator, `readArpeggio`, `loadArpeggio` and `setHold`.
2. **dmbk-graphql-api:** apply the collection validator update first, then deploy the schema and resolvers for `arpeggio`.
3. **Editor:** bump the engine, re-pull the schema, add the panel, storage, files and SHARED save. Deploy.
4. **windchime:** bump the engine, re-pull the schema, fetch and load `arpeggio`, add a changelog line. Deploy.

**Rollback:** each step is additive. Reverting the editor or windchime leaves stored `arpeggio` values unread, and the API field can stay.

## Open Questions

- **The real RATE range and gate length.** Look in Harman's analysis and the service notes, otherwise measure a recording. Calibration numbers only, no spec change.
- **Whether the hardware's UP_DOWN repeats the end notes.** Settle it against the owner's manual (issue #5) and adjust in a minor release if it differs.
