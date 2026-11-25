// The emulator in the audio thread: one Engine, fed by port messages from the synth on the main thread.
// Bundled with the engine by esbuild (pnpm build:worklet) into dist/worklet.js and src/worklet/code.generated.ts.

import { Engine } from "../engine/engine.ts";
import { PROCESSOR, type ToWorklet } from "./messages.ts";

class Juno60Processor extends AudioWorkletProcessor {
  private readonly engine = new Engine(sampleRate);

  constructor() {
    super();
    this.port.onmessage = (e: MessageEvent<ToWorklet>) => {
      const m = e.data;
      if (m.type === "patch") this.engine.setPatch(m.data);
      else if (m.type === "noteOn") this.engine.noteOn(m.note);
      else if (m.type === "noteOff") this.engine.noteOff(m.note);
      else if (m.type === "arp") this.engine.setArpeggio(m.on, m.mode, m.range, m.rate);
      else if (m.type === "hold") this.engine.setHold(m.on);
      else this.engine.allOff();
    };
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const out = outputs[0];
    const left = out?.[0];
    if (!out || !left) return true;
    const right = out[1] ?? left;
    left.fill(0);
    if (right !== left) right.fill(0);
    this.engine.render(left, right, left.length);
    return true;
  }
}

registerProcessor(PROCESSOR, Juno60Processor);
