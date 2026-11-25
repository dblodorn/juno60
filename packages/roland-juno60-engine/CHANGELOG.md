# Changelog

## 0.2.0 — 2026-11-24

The arpeggiator: UP, DOWN and UP_DOWN over 1–3 octaves at RATE, with HOLD, timed to the sample in the worklet and
the offline synth alike. Its settings load with `loadArpeggio()`, apart from the 42-byte patch (`readArpeggio`,
`DEFAULT_ARPEGGIO`); HOLD with `setHold()`, which also sustains released keys with the arpeggiator off. The RATE
curve (1.5–25 steps a second) and the step's gate (half the step) are estimates. With the arpeggiator off, notes
play as in 0.1.0. CPU: a six-note arpeggio at the fastest RATE with chorus I+II costs about 1.4% of a core (M4 Pro),
no more than the same chord held (1.5%).

## 0.1.0 — 2026-11-24

First release: an approximate Juno-60. Six voices (DCO saw, pulse with PWM from ENV, MAN or LFO, sub square,
noise), a resonant four-pole VCF with ENV, LFO and KYBD, the VCA in ENV or GATE, one ADSR per voice and one
delayed LFO, the shared HPF and the chorus I, II and I+II. Envelope times, the LFO delay, the HPF and the chorus
follow Andy Harman's measurements; the rest are estimates (see `src/engine/calibration.ts`).
