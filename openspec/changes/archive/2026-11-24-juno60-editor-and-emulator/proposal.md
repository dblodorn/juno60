# Proposal: Juno-60 editor and emulator

## Why
The user asked for a Juno-60 app built the way vz10m and dx7 are, from the sound design system's starter, to prove the
starter out. The Juno-60 has no MIDI, so v1 edits and plays patches with an emulator; it is an editor and a way to learn
the instrument, and the emulator is an approximate stand-in.

## What changes
- A new repo `dblodorn/juno60`: `apps/editor` (from `templates/sound-app`) and `packages/roland-juno60-engine`.
- The engine: six voices, measured envelope/LFO-delay/HPF/chorus (Andy Harman, MIT), estimates elsewhere.
- The editor: the panel, SOUND, KEYS, AUDIO, MIDI IN, LIBRARY → LOCAL (`.json`) and COLOPHON.

## Later changes (in order)
Shared patches on dmbk-graphql-api (`juno60-voices`) with LIBRARY → SHARED; publishing the engine; windchime's
`add-juno60-synth`. Issues: cassette dumps, the Tubbutec Juno-66 retrofit, calibration against recordings, the
arpeggiator.
