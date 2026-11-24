// The (?) notes: what each part of the Juno-60 does, in a player's terms, and what this editor and its emulator do
// with it. `source` names where a fact comes from when it isn't general synthesizer knowledge. The emulator is an
// approximate stand-in: say where it estimates.

export interface Help { title: string; body: string[]; editor?: string; source?: string }

const HARMAN = "Andy Harman's measurements of a Juno-60 (github.com/pendragon-andyh/Juno60)";

export const HELP = {
  lfo: {
    title: "LFO",
    body: [
      "One slow triangle wave for the whole instrument. It can wobble the pitch (DCO LFO), the pulse width (PWM in LFO mode) and the filter (VCF LFO). RATE sets its speed.",
      "DELAY TIME holds it back after you start playing, then fades it in, so vibrato arrives only on held notes. In AUTO the delay starts again whenever you play after letting go of every key.",
    ],
    editor: "MANUAL trigger is meant for the LFO button on the Juno-60's bender; the emulator has no bender, so in MANUAL the LFO plays at full depth. The delay follows the measured times; the rate range (0.3 to 20 Hz) is our estimate.",
    source: HARMAN,
  },
  dco: {
    title: "DCO",
    body: [
      "One oscillator per voice, kept in tune by a digital clock, which is why the Juno-60 stays in tune where older synths drift. Its waves can be switched on together: PULSE, SAW and SUB (a square an octave lower), with NOISE mixed in by its slider.",
      "RANGE picks the octave: 16' is an octave down, 8' is concert pitch, 4' an octave up. LFO adds vibrato.",
    ],
    editor: "The waves are drawn with smoothed edges so high notes don't alias. Mix levels and the vibrato depth are estimates.",
  },
  pwm: {
    title: "PWM",
    body: [
      "Narrows the pulse wave from a square (hollow, like a clarinet) towards a thin pulse (nasal, reedy). PWM MODE chooses what moves it: MAN holds it where the slider is, LFO sweeps it back and forth for a chorused shimmer, ENV follows the envelope so the tone opens as a note swells.",
    ],
    editor: "Only heard with PULSE on. How narrow the pulse gets at 10 is our estimate.",
  },
  hpf: {
    title: "HPF",
    body: ["A high-pass filter shared by all six voices, with four positions: 0 lets everything through; 1, 2 and 3 thin out the bass more and more. Useful to keep a pad out of the bass player's way."],
    editor: "Positions 1–3 cut below about 154, 339 and 720 Hz, gently (6 dB per octave), from the measured circuit values.",
    source: HARMAN,
  },
  vcf: {
    title: "VCF",
    body: [
      "The low-pass filter that shapes the tone: FREQ is how bright the sound is, RES (resonance) adds a peak at that point and, turned up high, makes the filter whistle on its own.",
      "ENV opens the filter with the envelope (or closes it, with ENV POLARITY inverted), LFO wobbles it, and KYBD makes higher notes brighter so the tone stays even across the keyboard.",
    ],
    editor: "A four-pole (24 dB per octave) resonant filter, written for this emulator. Its frequency range and modulation depths are estimates until compared with recordings.",
  },
  vca: {
    title: "VCA",
    body: [
      "Sets each note's loudness over time. In ENV mode the envelope shapes it; in GATE mode notes start and stop at once, like an organ, while the envelope still shapes the filter and PWM. LEVEL is the overall volume, −5 to +5.",
    ],
    editor: "GATE's 3 ms attack and 6 ms release are measured; LEVEL's ±10 dB is our estimate.",
    source: HARMAN,
  },
  env: {
    title: "ENV",
    body: [
      "One ADSR envelope per voice: ATTACK is how long a note takes to reach full level, DECAY how long it then falls to the SUSTAIN level, which it holds while the key is down, and RELEASE how long it fades after you let go.",
      "The same envelope can drive the VCA, the filter (VCF ENV) and the pulse width (PWM MODE ENV), which is why one set of sliders shapes both loudness and tone.",
    ],
    editor: "Times and curves follow the measurements: attack from 1 ms to about 3 s, decay and release from 2 ms to about 17 s, each curving like a charging capacitor.",
    source: HARMAN,
  },
  chorus: {
    title: "CHORUS",
    body: [
      "The Juno-60's famous chorus: the sound is copied into two short delays whose length slowly sways, one per side, so the patch widens into stereo. I is gentle, II is deeper and faster; both buttons together give a fast, narrow vibrato, mono.",
    ],
    editor: "Rates and delay sweeps are measured; the mix of dry and delayed sound and the filtering before the delays are estimates.",
    source: HARMAN,
  },
  sound: {
    title: "SOUND (EMULATOR)",
    body: ["Plays the patch in the browser with an approximate emulation of the Juno-60: six voices, the DCO, filters, envelope, LFO and chorus. It needs no hardware. Play it with KEYS, the Z–M keys, or a keyboard on MIDI IN."],
    editor: "A stand-in for hearing your edits and for learning what each control does, not a replacement for the instrument: some curves are measured from a real Juno-60, others are estimates (each is marked in the engine's calibration file). The Juno-60 has no velocity, and neither does the emulator.",
  },
  keys: {
    title: "KEYS",
    body: ["A floating two-octave keyboard for the emulator. The Z–M computer keys play C4 to C5 too, and a keyboard on MIDI IN plays it as well."],
  },
  midi: {
    title: "MIDI IN",
    body: [
      "A stock Juno-60 has no MIDI: it has Roland's earlier DCB port, and it saves patches to cassette tape. So this editor can't send patches to the instrument. MIDI IN plays the emulator from a keyboard or a sequencer.",
    ],
    editor: "Cassette dumps and MIDI retrofit kits (such as Tubbutec's Juno-66) are planned as later changes.",
  },
  library: {
    title: "LIBRARY",
    body: [
      "LOCAL keeps patches in this browser: save the one you're editing, open, rename or delete them, and move them in and out as .json files.",
      "COLOPHON: the typeface, what this editor is for, the work it builds on, and pages elsewhere about the Juno-60.",
    ],
  },
  patch: {
    title: "THE PATCH",
    body: [
      "The Juno-60 remembers 56 patches (numbered 11 to 78) but has no published data format, so this editor stores a patch its own way: one value per panel control, sliders 0–127 shown on the panel's 0–10 scale.",
    ],
  },
} satisfies Record<string, Help>;

export type HelpKey = keyof typeof HELP;
