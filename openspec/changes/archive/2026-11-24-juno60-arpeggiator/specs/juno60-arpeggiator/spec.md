# Spec Delta

## Purpose

Defines the Juno-60 arpeggiator: how it plays the notes held, and the arpeggiator settings, a section of their own
kept beside a patch (never inside its 42 sound bytes), so the editor and windchime arpeggiate a patch the same way.

## ADDED Requirements

### Requirement: Arpeggiator settings
The arpeggiator settings SHALL be a section of their own with exactly these fields: `version` (1), `on` (true or
false), `mode` (`UP`, `DOWN` or `UP_DOWN`), `range` (1, 2 or 3 octaves) and `rate` (0–127, read on the panel's 0–10
scale). Their JSON form SHALL be that object, the same in patch files, in the API and in the engine. A patch without
the section SHALL behave as `{ version: 1, on: false, mode: "UP", range: 1, rate: 64 }`. Settings with a missing or
unknown field value, or another `version`, SHALL be refused with the field named, and the settings held before SHALL
stay. HOLD SHALL NOT be part of the settings.

#### Scenario: Defaults
- **WHEN** a patch with no arpeggiator settings is loaded
- **THEN** the arpeggiator is off, and notes play as they did before this change

#### Scenario: Refused settings
- **WHEN** settings with `range: 4` are loaded
- **THEN** loading throws naming `range`, and the arpeggiator keeps its previous settings

#### Scenario: The sound bytes are untouched
- **WHEN** a patch is saved with arpeggiator settings and its 42 bytes are read back
- **THEN** they are identical to the patch saved without settings

### Requirement: Note order
While the arpeggiator is on, the notes held SHALL play one at a time in pitch order, over `range` octaves: UP from the
lowest held note upward through each octave, DOWN from the highest downward, UP_DOWN up then down without repeating
the top and bottom notes. A note added or released SHALL change the sequence from the next step without restarting
it. With no notes held, it SHALL stop; the next note held SHALL start the sequence from its first step.

#### Scenario: UP over two octaves
- **WHEN** C4, E4 and G4 are held with mode UP and range 2
- **THEN** the steps are C4 E4 G4 C5 E5 G5, then again from C4

#### Scenario: UP_DOWN
- **WHEN** C4, E4 and G4 are held with mode UP_DOWN and range 1
- **THEN** the steps are C4 E4 G4 E4, then again from C4

### Requirement: Rate and timing
`rate` SHALL set the step rate, slower at 0 and faster at 127, by a curve whose numbers are labelled MEASURED or
ESTIMATE where the engine's other calibration lives. Each step SHALL release its note before the next step starts.
Steps SHALL be timed to the audio sample, not to the page, so a busy page does not change their spacing.

#### Scenario: Steady steps
- **WHEN** an arpeggio runs at a fixed rate for 10 s, rendered offline
- **THEN** every step starts within one sample of its expected time

### Requirement: HOLD
With HOLD on, releasing every key SHALL keep the last notes held arpeggiating; holding new notes after all were
released SHALL replace them. Turning HOLD off SHALL release the notes no longer physically held. All notes off
SHALL stop the arpeggio and clear its held notes, HOLD's included. With the arpeggiator off, HOLD SHALL sustain
released notes by the same rules, as on the Juno-60.

#### Scenario: Latched chord
- **WHEN** HOLD is on and a chord is played and released
- **THEN** the arpeggio keeps playing that chord until a new chord is played, HOLD is turned off, or all notes are turned off

#### Scenario: HOLD without the arpeggiator
- **WHEN** the arpeggiator is off, HOLD is on, and a chord is played and released
- **THEN** the chord keeps sounding until a new chord is played or HOLD is turned off

### Requirement: Arpeggiator off
With `on` false, notes SHALL play as without an arpeggiator. Turning it off SHALL end the step sounding; turning it
on SHALL arpeggiate the notes held at that moment.

#### Scenario: Switching on with notes held
- **WHEN** a chord is held and the arpeggiator is switched on
- **THEN** the chord's notes stop sounding together and the arpeggio starts from its first step
