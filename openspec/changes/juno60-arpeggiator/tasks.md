# Tasks

## 1. Arpeggiator settings (engine package)

- [x] 1.1 Add `src/arpeggio.ts`: the settings type, `DEFAULT_ARPEGGIO` (`{ version: 1, on: false, mode: "UP", range: 1, rate: 64 }`), `readArpeggio(x)` (refuses missing or unknown values and other versions, naming the field) and the RATE panel display; export them from `src/index.ts`; verify with `test/arpeggio.test.ts` (defaults, every field refused, frozen result)
- [x] 1.2 Add the RATE step curve and `ARP_GATE` to `src/engine/calibration.ts`, both labelled ESTIMATE with their source noted; verify a test that step length falls monotonically from rate 0 to 127

## 2. Arpeggiator in the engine

- [x] 2.1 Add the `Arp` to `src/engine/` (held flags and sorted notes in typed arrays, step and sample counters, UP / DOWN / UP_DOWN over 1–3 octaves, gate release, HOLD with physical and latched keys) and route `Engine.noteOn`/`noteOff`/`allOff` through it; verify the spec's note-order scenarios (UP over two octaves, UP_DOWN without repeated ends) in `test/arp.test.ts`
- [x] 2.2 Split `Engine.render()` at step boundaries so each step starts on its sample; verify that an offline 10 s arpeggio has every step within one sample of its expected time
- [x] 2.3 Cover the arpeggiator's live behaviour: a note added or released mid-sequence, switching on with a chord held, switching off, a patch change keeping the arpeggio, HOLD latch / replace / off, all notes off clearing HOLD; verify each as a test in `test/arp.test.ts`
- [x] 2.4 Add `loadArpeggio(settings)` and `setHold(on)` to the offline synth, and to the worklet synth through a new `arp` / `hold` message (checked on the main thread, numbers only to the worklet); verify that `test/synth.test.ts` posts the right messages and that the offline and worklet paths give the same step times
- [x] 2.5 Extend `test/alloc.test.ts` with a six-note, three-octave arpeggio with the chorus on; verify the heap grows by less than 64 KiB over 1000 blocks
- [x] 2.6 Measure CPU with an arpeggio at the fastest rate against the current about 1.2% of a core, and note the result in the CHANGELOG entry
- [x] 2.7 README (the arpeggiator, settings beside the patch, still an approximate stand-in), CHANGELOG 0.2.0, and the smoke script plays an arpeggio from the packed package; verify `pnpm -F @dblodorn/roland-juno60-engine test`, typecheck, build and smoke all pass

## 3. Release the engine

- [ ] 3.1 Merge the engine work (in the same PR as the editor, after dmbk-graphql-api#52 deploys), push tag `roland-juno60-engine@0.2.0`, and verify the publish run succeeds and 0.2.0 is listed on GitHub Packages

## 4. API (dmbk-graphql-api, its own change and PR)

- [x] 4.1 Open an OpenSpec change there for `juno60-voices`: an optional `arpeggio` on `Juno60Voice`, its input, and the duplicate rule covering `data` plus `arpeggio`; verify `openspec validate --strict` passes
- [x] 4.2 Add the `Juno60Arpeggio` type, the `Juno60ArpeggioMode` enum, `Juno60ArpeggioInput` on save and update (same checks as `readArpeggio`, `BAD_USER_INPUT` naming the field), storage as an optional subdocument, and the duplicate check; verify `npm run typecheck` and the mutation tests (save with and without `arpeggio`, a refused field, the same sound with two arpeggios)
- [ ] 4.3 Update the `juno60_voices` collection validator (`juno60:collection -- --apply`) before deploying, then merge and deploy; verify that production returns `arpeggio: null` for the factory patches

## 5. Editor

- [x] 5.1 The editor uses the engine from the workspace (`workspace:*`), so no bump is needed; re-pull the API schema (from a local server running dmbk-graphql-api#52 until it deploys) and verify that `pnpm build` passes
- [x] 5.2 Add the ARPEGGIO panel section first (ON, MODE UP / U&D / DOWN, RANGE 1 / 2 / 3, RATE slider, HOLD), with edits undoable and the 42 bytes untouched; verify with a test that arpeggiator edits leave the patch bytes identical, and in the browser
- [x] 5.3 Wire the arpeggiator to the synth: `loadArpeggio` on every settings or patch change (the default for a patch without one), `setHold` from HOLD, and KEYS, Z–M keys and MIDI IN feeding it; verify in the browser that MIDI IN with a stubbed chord is arpeggiated
- [x] 5.4 LOCAL stores `{ data, arpeggio? }` (old records load with the arpeggiator off); patch files move to version 2 with an optional `arpeggio`, importing versions 1 and 2; verify the round trip and version 1 import tests in `test/juno60.test.ts`
- [x] 5.5 SHARED saves, updates and opens `arpeggio` with the patch (fragment and mutations, relay recompiled); verify against the local API that a saved arpeggio comes back on open
- [x] 5.6 Help text for the ARPEGGIO controls, a changelog line, COLOPHON PRIOR WORK naming the arpeggiator's sources, and README; verify build, tests and a browser check of the panel at 390 and 1280 px, then open the PR

## 6. windchime (its own PR, after 3.1 and 4.3)

- [ ] 6.1 Bump `@dblodorn/roland-juno60-engine` to 0.2.0 (release-age exclude), re-pull the schema, and add the optional `loadArpeggio` to `SynthLike`; verify `pnpm build`
- [ ] 6.2 Fetch `arpeggio` with a Juno-60 patch (inline fragment on `Juno60Voice` in `lib/patches.ts`) and call `loadArpeggio` when the patch loads, using the default for INIT, a missing value or another synth; verify in Playwright, with a stubbed patch whose arpeggio is on, that the engine receives the `arp` message and that strikes arpeggiate
- [ ] 6.3 Changelog line, CLAUDE.md (an external synth's arpeggio travels with the patch; links and saves unchanged); verify typecheck and build, then open the PR

## 7. Close out

- [ ] 7.1 After everything has deployed, check live that an editor patch saved with the arpeggiator on arpeggiates in the editor and in windchime, then close issue #4 and archive this change
