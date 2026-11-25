# Spec Delta

## ADDED Requirements

### Requirement: Arpeggiator in the engine
The synth, the AudioWorklet one and the offline one alike, SHALL load arpeggiator settings separately from the patch,
with the rules of the `juno60-arpeggiator` capability, and SHALL take HOLD on and off as a performance control. A
patch load SHALL NOT change the arpeggiator settings, and a settings load SHALL NOT change the patch. The same calls
SHALL give the same samples offline and in the worklet.

#### Scenario: Patch change keeps the arpeggio
- **WHEN** an arpeggio is running and a new patch is loaded
- **THEN** the arpeggio continues with the same notes and settings, in the new patch's sound

#### Scenario: Offline and worklet agree
- **WHEN** the same patch, settings and notes are played offline and in the worklet
- **THEN** both give the same step times and notes

## MODIFIED Requirements

### Requirement: Real-time safety
`render()` SHALL never allocate, with the arpeggiator on or off, and render code SHALL read numbers only from typed
arrays.

#### Scenario: No garbage
- **WHEN** six voices with every source and the chorus on render 1000 blocks after warming up
- **THEN** the heap grows by less than 64 KiB

#### Scenario: No garbage while arpeggiating
- **WHEN** a six-note arpeggio over three octaves with the chorus on renders 1000 blocks after warming up
- **THEN** the heap grows by less than 64 KiB
