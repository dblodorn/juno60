"use client";

// The keyboard floater: the package's KeyboardFloater (two octaves of keys in a panel dragged by its title row, kept
// inside the viewport) with OCTAVE. Notes go through the router (lib/router.ts), so keys light up however they are
// played. The Juno-60 has no velocity, so there's no VELOCITY control. The position is saved on drag end.

import { useEffect, useState, useSyncExternalStore } from "react";
import { Button, KeyboardFloater as Floater, noteName } from "@dblodorn/sound-ui";
import { router } from "../lib/router";
import { store } from "../lib/store";
import * as A from "../lib/audio";
import { SMALL } from "./params";
import Info from "./Info";

const KEYS = 25; // two octaves and the top C
const LOWEST = { min: 12, max: 96, start: 48 }; // C0 ... C7, starting at C3

interface Props {
  onClose: () => void;
  // starts SOUND inside the current press; resolves false if it couldn't
  ensureSound: () => Promise<boolean>;
}

const subscribe = (fn: () => void) => router.onHeld(fn);
const getHeld = () => router.held();

export default function KeyboardFloater({ onClose, ensureSound }: Props) {
  const [low, setLow] = useState(LOWEST.start);
  const [pos, setPos] = useState<{ x: number; y: number } | undefined>(undefined);
  const held = useSyncExternalStore(subscribe, getHeld, getHeld);

  // settings, read after mount (SSR) and remembered
  useEffect(() => {
    setLow(Math.max(LOWEST.min, Math.min(LOWEST.max, store.get("keys.low", LOWEST.start))));
    const p = store.get<{ x: number; y: number } | null>("keys.pos", null);
    if (p) setPos(p);
  }, []);
  useEffect(() => { store.set("keys.low", low); }, [low]);
  // closing the floater ends whatever it was holding
  useEffect(() => () => router.allOff(), []);

  return (
    <Floater title="KEYS" range={`${noteName(low)}–${noteName(low + KEYS - 1)}`} info={<Info k="keys" />} onClose={onClose}
      position={pos} onPositionChange={p => store.set("keys.pos", p)}
      low={low} count={KEYS} held={held} onNoteOn={n => router.noteOn(n)} onNoteOff={n => router.noteOff(n)}
      beforePlay={() => (A.running() ? true : ensureSound())}>
      <div className="flex items-center gap-1.5">
        <span id="k-oct-label" className={SMALL}>OCTAVE</span>
        <Button aria-label="OCTAVE DOWN" disabled={low <= LOWEST.min} onClick={() => { router.allOff(); setLow(l => Math.max(LOWEST.min, l - 12)); }}>−</Button>
        <Button aria-label="OCTAVE UP" disabled={low >= LOWEST.max} onClick={() => { router.allOff(); setLow(l => Math.min(LOWEST.max, l + 12)); }}>+</Button>
      </div>
    </Floater>
  );
}
