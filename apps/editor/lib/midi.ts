// MIDI IN, to play the emulator from a keyboard or a sequencer. A stock Juno-60 has no MIDI (it has Roland's DCB
// port), so nothing is sent: the editor only listens for notes. Access is asked for only from the CONNECT MIDI click,
// without SysEx. The chosen input is remembered by name, so it comes back when it's plugged in again.

export interface PortInfo { id: string; name: string; manufacturer: string }

let access: MIDIAccess | null = null;
let input: MIDIInput | null = null;
let wanted = ""; // the chosen input's name, kept while it's unplugged
const listeners = new Set<() => void>();
let onNoteOn: (note: number) => void = () => {};
let onNoteOff: (note: number) => void = () => {};

export const supported = (): boolean => typeof navigator !== "undefined" && "requestMIDIAccess" in navigator;

export function onChange(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; }
const changed = (): void => listeners.forEach(fn => fn());

export function handleNotes(on: (note: number) => void, off: (note: number) => void): void { onNoteOn = on; onNoteOff = off; }

function onMessage(e: MIDIMessageEvent): void {
  const d = e.data;
  if (!d || d.length < 3) return;
  const kind = d[0]! & 0xf0, note = d[1]!, vel = d[2]!;
  if (kind === 0x90 && vel > 0) onNoteOn(note);
  else if (kind === 0x80 || (kind === 0x90 && vel === 0)) onNoteOff(note);
}

function adopt(): void {
  if (!access) return;
  const ports = [...access.inputs.values()];
  const next = ports.find(p => p.name === wanted && p.state === "connected") ?? null;
  if (next === input) return;
  if (input) input.onmidimessage = null;
  input = next;
  if (input) input.onmidimessage = onMessage;
  changed();
}

export async function connect(): Promise<void> {
  if (!supported()) throw new Error("THIS BROWSER HAS NO WEB MIDI. USE CHROME OR EDGE ON A COMPUTER.");
  access = await navigator.requestMIDIAccess({ sysex: false });
  access.onstatechange = () => { adopt(); changed(); };
  if (!wanted && access.inputs.size === 1) wanted = [...access.inputs.values()][0]!.name ?? "";
  adopt();
  changed();
}

export function setWanted(name: string): void { wanted = name; adopt(); changed(); }

export function select(id: string): void {
  const p = id && access ? access.inputs.get(id) : undefined;
  wanted = p?.name ?? "";
  adopt();
  changed();
}

export const listInputs = (): PortInfo[] =>
  access ? [...access.inputs.values()].filter(p => p.state === "connected").map(p => ({ id: p.id, name: p.name ?? "", manufacturer: p.manufacturer ?? "" })) : [];

export const status = (): { connected: boolean; input: PortInfo | null; wanted: string } => ({
  connected: !!access,
  input: input ? { id: input.id, name: input.name ?? "", manufacturer: input.manufacturer ?? "" } : null,
  wanted,
});
