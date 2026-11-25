// @dblodorn/roland-juno60-engine: an approximate Roland Juno-60 emulator as a sound source. Everything here reads or
// plays a patch; nothing changes one (that's the editor's, in apps/editor).

export { displayOf, get, getName, readVoice } from "./codec.ts";
export {
  ARPEGGIO_MODES, ARPEGGIO_RANGES, ARPEGGIO_VERSION, arpeggioRateDisplay, DEFAULT_ARPEGGIO, readArpeggio, type Arpeggio,
  type ArpeggioMode,
} from "./arpeggio.ts";
export {
  CHORUS_MODES, ENV_POLARITIES, fieldOf, HPF_POSITIONS, LFO_TRIGGERS, NAME_BYTE, NAME_LENGTH, OFF_ON, PATCH_NUMBERS,
  PWM_MODES, RANGES, SECTIONS, SLIDER_MAX, toPanel, VCA_MODES, VOICE_BYTES, VOICE_FIELDS, voiceField, type Field, type Section,
} from "./params.ts";
export { POLYPHONY } from "./engine/engine.ts";
export { createOfflineSynth, type OfflineSynth } from "./offline.ts";
export { createSynth, type Synth, type SynthOptions } from "./synth.ts";
export type { PatchPage, PatchQuery, PatchSource, PatchSummary } from "./sources/patch-source.ts";
