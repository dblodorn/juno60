# Changelog

## 0.1.0 — 2026-11-24

First release: an approximate Juno-60. Six voices (DCO saw, pulse with PWM from ENV, MAN or LFO, sub square,
noise), a resonant four-pole VCF with ENV, LFO and KYBD, the VCA in ENV or GATE, one ADSR per voice and one
delayed LFO, the shared HPF and the chorus I, II and I+II. Envelope times, the LFO delay, the HPF and the chorus
follow Andy Harman's measurements; the rest are estimates (see `src/engine/calibration.ts`).
