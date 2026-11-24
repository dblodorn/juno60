# juno60-engine Specification

## Purpose
Defines what the Juno-60 emulator plays, so a patch sounds the same in the editor, in windchime and offline, where each
part of the model comes from, and that it presents itself as an approximate stand-in.

## Requirements

### Requirement: Patch format
A patch SHALL be 42 bytes in the layout of `src/params.ts`: one byte per panel control in panel order, sliders 0–127,
switches as small integers, then a 16-character name. Loading SHALL refuse a patch of another length or with a value
outside its field's range, and keep the patch it had.

#### Scenario: Out of range
- **WHEN** a patch with CHORUS = 4 is loaded
- **THEN** loading throws, naming the field, and the previous patch keeps playing

### Requirement: Voice structure
The engine SHALL play six voices, each a DCO (saw, pulse with PWM from ENV, MAN or LFO, sub square, noise; RANGE 16',
8', 4'), a resonant four-pole low-pass VCF with ENV (either polarity), LFO and KYBD, and a VCA in ENV or GATE, with one
ADSR per voice; one delayed triangle LFO for the instrument; the shared HPF (four positions) and the chorus (OFF, I,
II, I+II). The Juno-60 has no velocity: any velocity above 0 plays the same.

#### Scenario: Pitch
- **WHEN** a saw at 8' plays MIDI note 60
- **THEN** it sounds at 261.6 Hz within 4 Hz

#### Scenario: Chorus is stereo
- **WHEN** CHORUS I is on
- **THEN** the left and right outputs differ; with CHORUS OFF or I+II they are the same

### Requirement: Sources and calibration
Every tunable number SHALL live in `src/engine/calibration.ts`, labelled MEASURED (Andy Harman's Juno-60 analysis, MIT,
named in `NOTICE`), PANEL, or ESTIMATE. No code SHALL come from JunoX (GPL-3.0). A change to a number SHALL be released
as at least a minor version, with a changelog line saying which sound changed.

#### Scenario: Measured attack
- **WHEN** ATTACK is 5 on the panel
- **THEN** the note reaches full level after about 0.24 s

### Requirement: Real-time safety
`render()` SHALL never allocate, and render code SHALL read numbers only from typed arrays.

#### Scenario: No garbage
- **WHEN** six voices with every source and the chorus on render 1000 blocks after warming up
- **THEN** the heap grows by less than 64 KiB

### Requirement: Stand-in, said plainly
The package README SHALL say the emulator is an approximate stand-in for the Juno-60, made for hearing patches while
editing and for learning, not a replacement for the instrument.
