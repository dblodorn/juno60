# juno60-editor Specification

## Purpose
Defines the Juno-60 editor: editing a patch on the instrument's panel, hearing it, keeping it, and what the editor
says about itself and its sources.

## Requirements

### Requirement: The panel
The editor SHALL show the patch's controls in the Juno-60's sections and order (LFO, DCO, HPF, VCF, VCA, ENV, CHORUS),
with sliders read on the panel's 0–10 scale (VCA LEVEL −5…+5), PULSE, SAW and SUB as switches, HPF as a four-position
slider and CHORUS as two buttons, I and II, that can both be on. Every edit SHALL change only that field's byte and be
undoable.

#### Scenario: Both chorus buttons
- **WHEN** I and II are both pressed
- **THEN** the patch's CHORUS is I+II

### Requirement: Hearing it
SOUND SHALL start the emulator inside the click. KEYS, the Z–M computer keys and MIDI IN (notes on any channel, no
SysEx, access asked only from CONNECT MIDI) SHALL play it. A change to the patch SHALL reach notes already sounding.

### Requirement: No hardware link
The editor SHALL NOT send anything to a Juno-60, and SHALL say why: a stock Juno-60 has no MIDI (DCB port, cassette).

### Requirement: Library
LIBRARY → LOCAL SHALL keep patches in the browser (save, open, delete, search) and SHALL export and import `.json`
files of named panel values (`format: "dmbk-juno60-patches"`, `version: 1`), refusing values out of range with the
patch and field named.

#### Scenario: Round trip
- **WHEN** two patches are exported and the file is imported
- **THEN** the same two patches, byte for byte, are added to LOCAL

### Requirement: Colophon
LIBRARY → COLOPHON SHALL credit the typeface first, then the sound design system, then ABOUT (an editor and a way to
learn the Juno-60; the emulator is an approximate stand-in), then PRIOR WORK (Andy Harman's analysis, JunoX, and any
later source the code or sound draws on), then RESOURCES.
