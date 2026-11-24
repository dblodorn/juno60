// Every note the editor plays goes through here (KEYS, the computer keys, MIDI IN), so held keys light up however
// they're played, and a key held from two places sounds once and stops when the last one lets go.

import * as A from "./audio.ts";

const counts = new Map<number, number>();
const listeners = new Set<() => void>();
let snapshot: ReadonlySet<number> = new Set();

function changed(): void {
  snapshot = new Set(counts.keys());
  listeners.forEach(fn => fn());
}

export const router = {
  noteOn(note: number): void {
    const n = counts.get(note) ?? 0;
    counts.set(note, n + 1);
    if (n === 0) { A.noteOn(note); changed(); }
  },
  noteOff(note: number): void {
    const n = counts.get(note);
    if (!n) return;
    if (n > 1) { counts.set(note, n - 1); return; }
    counts.delete(note);
    A.noteOff(note);
    changed();
  },
  allOff(): void {
    if (!counts.size) return;
    counts.forEach((_, note) => A.noteOff(note));
    counts.clear();
    changed();
  },
  held: (): ReadonlySet<number> => snapshot,
  onHeld(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; },
};
