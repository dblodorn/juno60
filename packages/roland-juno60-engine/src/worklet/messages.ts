// Main thread -> emulator worklet. Shared by the synth and worklet/processor.ts. The processor name carries the
// package's name, so engines from different packages can share one AudioContext.
export const PROCESSOR = "roland-juno60-engine";

export type ToWorklet =
  | { type: "patch"; data: Uint8Array } // 42 patch bytes, checked
  | { type: "noteOn"; note: number }
  | { type: "noteOff"; note: number }
  | { type: "allOff" }
  | { type: "arp"; on: boolean; mode: number; range: number; rate: number } // checked; mode 0 UP, 1 DOWN, 2 UP_DOWN
  | { type: "hold"; on: boolean };
