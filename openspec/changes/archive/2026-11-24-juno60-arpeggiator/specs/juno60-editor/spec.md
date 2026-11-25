# Spec Delta

## ADDED Requirements

### Requirement: Playing the arpeggiator
KEYS, the Z–M computer keys and MIDI IN SHALL feed the arpeggiator when it is on. HOLD SHALL be a switch on the
ARPEGGIO section that is never saved and is off when the page loads. A change to the arpeggiator settings SHALL reach
an arpeggio already running.

#### Scenario: MIDI IN arpeggiated
- **WHEN** the arpeggiator is on and a chord arrives over MIDI IN
- **THEN** the chord is arpeggiated, as from KEYS

## MODIFIED Requirements

### Requirement: The panel
The editor SHALL show the patch's controls in the Juno-60's sections and order (ARPEGGIO, LFO, DCO, HPF, VCF, VCA,
ENV, CHORUS), with sliders read on the panel's 0–10 scale (VCA LEVEL −5…+5), PULSE, SAW and SUB as switches, HPF as a
four-position slider and CHORUS as two buttons, I and II, that can both be on. ARPEGGIO SHALL hold ON, MODE (UP, U&D,
DOWN), RANGE (1, 2, 3), RATE and HOLD. Every edit SHALL change only that field's byte, or only that arpeggiator
setting, and be undoable.

#### Scenario: Both chorus buttons
- **WHEN** I and II are both pressed
- **THEN** the patch's CHORUS is I+II

#### Scenario: Arpeggiator edits leave the sound bytes alone
- **WHEN** MODE, RANGE or RATE is changed
- **THEN** the patch's 42 bytes are unchanged and only its arpeggiator settings differ

### Requirement: Library
LIBRARY → LOCAL SHALL keep patches with their arpeggiator settings in the browser (save, open, delete, search), and
LIBRARY → SHARED SHALL save and update them with the patch. LOCAL SHALL export `.json` files of named panel values
with an optional `arpeggio` object per patch (`format: "dmbk-juno60-patches"`, `version: 2`), SHALL import versions 1
and 2 (a patch without `arpeggio` gets the default settings), and SHALL refuse values out of range with the patch and
field named. Opening a patch saved without arpeggiator settings SHALL turn the arpeggiator off.

#### Scenario: Round trip
- **WHEN** two patches with arpeggiator settings are exported and the file is imported
- **THEN** the same two patches, byte for byte, with the same settings, are added to LOCAL

#### Scenario: Version 1 file
- **WHEN** a version 1 file is imported
- **THEN** its patches are added with the arpeggiator off
