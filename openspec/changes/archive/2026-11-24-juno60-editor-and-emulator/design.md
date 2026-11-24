# Design: Juno-60 editor and emulator

## Patch format
The Juno-60 stores 56 patches but publishes no data format, so a patch is this project's own 42 bytes: one byte per
stored control (the controls JunoX's factory patch sheet records), sliders 0–127 (the Juno-106 SysEx's convention),
switches as small integers, a 16-character name. Values travel in `.json` files as named panel values, readable by a
player. A cassette reader, later, maps tape data onto the same bytes.

## Sources
| Fact | Source | Status |
| --- | --- | --- |
| 6 voices, DCO + sub, 24 dB VCF, HPF, one ADSR, one triangle LFO, chorus with both buttons, 56 patches, DCB, no MIDI | Wikipedia's Roland Juno-60 article | published |
| Envelope times and curves, GATE times, LFO delay table, HPF positions, chorus rates and delays, noise low-pass | Andy Harman's Juno-60 analysis (MIT) | measured |
| Stored controls and panel readings (PWM E/L/M, VCF N/I, VCA E/G, LFO A/M) | JunoX's factory patch sheet | community transcription |
| PWM MODE switch positions ENV / MANUAL / LFO | Roland's spec listing, as quoted by a search | order unverified |
| LFO rate range, VCF range and modulation depths, resonance, PWM depth, mix levels, VCA LEVEL, chorus mix | — | ESTIMATE |

The owner's manual wasn't readable here (Roland's support site refuses automated fetches; the archive copy found was
the JUNO-Di's), so anything only it would settle stays flagged.

## Engine
Written fresh. DCO as a phase counter with PolyBLEP; VCF a zero-delay-feedback four-pole ladder with a tanh input;
envelopes as RC charge/discharge towards points just past their goal so each segment lands at its measured time; one
LFO with the measured delay; HPF one-pole; chorus two interpolated delay lines swept by one triangle in antiphase. A new
patch applies to sounding notes at once (live panel). Render is allocation-free: state in typed arrays, the patch
decoded into a Float64Array, numbers passed between non-inlined calls through typed arrays. About 1.2% of one core for
six voices with chorus II (M-series, Node).

## Editor
From the starter, with dx7's audio, store, AUDIO dialog and keyboard floater. MIDI IN only. The (?) notes teach each
section and say where the emulator estimates.
