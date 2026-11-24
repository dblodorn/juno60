"use client";

// The editor's one client root, built on dx7's components/Editor.tsx: the header (name, undo, INIT, SOUND, KEYS,
// AUDIO, MIDI, LIBRARY), the AUDIO and MIDI dialogs, computer-key audition, and the Juno-60's panel in its own order:
// LFO, DCO, HPF, VCF, VCA, ENV, CHORUS. Every edit goes through the codec's set() on the patch's 42 bytes
// (lib/juno60/codec.ts).

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import * as A from "../lib/audio";
import * as M from "../lib/midi";
import { router } from "../lib/router";
import * as V from "../lib/juno60/codec";
import { fromB64, loadLibrary, saveLibrary, store, toB64, type Entry } from "../lib/store";
import type { HelpKey } from "../lib/help";
import Info from "./Info";
import { Check, FieldRow, H2, NOTE, Param, ParamSelect, ParamSlider, ROW, SMALL } from "./params";
import {
  Button, Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, Leader, SelectItem,
} from "@dblodorn/sound-ui";

const Library = dynamic(() => import("./Library"), { ssr: false });
const KeyboardFloater = dynamic(() => import("./KeyboardFloater"), { ssr: false });

interface Device { id: string; label: string }
const deviceName = (d: Device): string => (d.label || "UNNAMED DEVICE").toUpperCase();
const portName = (p: M.PortInfo): string => p.name.toUpperCase() + (p.manufacturer ? "   " + p.manufacturer.toUpperCase() : "");
// computer keys for auditioning: the bottom letter row plays C4 to C5
const KEYS: Record<string, number> = { z: 60, s: 61, x: 62, d: 63, c: 64, v: 65, g: 66, b: 67, h: 68, n: 69, j: 70, m: 71, ",": 72 };

// Undo history: every edit pushes the whole patch (42 bytes), capped.
const LIMIT = 200;
interface History { past: Uint8Array[]; voice: Uint8Array; future: Uint8Array[] }
type Action = { type: "edit"; voice: Uint8Array } | { type: "undo" } | { type: "redo" };

function history(state: History, action: Action): History {
  switch (action.type) {
    case "edit": return { past: [...state.past, state.voice].slice(-LIMIT), voice: action.voice, future: [] };
    case "undo": {
      const prev = state.past.at(-1);
      return prev ? { past: state.past.slice(0, -1), voice: prev, future: [state.voice, ...state.future] } : state;
    }
    case "redo": {
      const next = state.future[0];
      return next ? { past: [...state.past, state.voice], voice: next, future: state.future.slice(1) } : state;
    }
  }
}

// The panel, section by section: [heading, its (?), its rows]. A row is a field key; on/off switches draw as
// checkboxes, the rest as the package's rows.
const PANEL: readonly { title: string; info: HelpKey; rows: readonly (string | { key: string; info: HelpKey })[] }[] = [
  { title: "LFO", info: "lfo", rows: ["lfoRate", "lfoDelay", "lfoTrigger"] },
  { title: "DCO", info: "dco", rows: ["range", "dcoLfo", { key: "dcoPwm", info: "pwm" }, "pwmMode", "pulse", "saw", "sub", "dcoSub", "dcoNoise"] },
  { title: "HPF", info: "hpf", rows: ["hpf"] },
  { title: "VCF", info: "vcf", rows: ["vcfFreq", "vcfRes", "vcfPolarity", "vcfEnv", "vcfLfo", "vcfKybd"] },
  { title: "VCA", info: "vca", rows: ["vcaMode", "vcaLevel"] },
  { title: "ENV", info: "env", rows: ["envA", "envD", "envS", "envR"] },
];
const ENV_LABELS: Record<string, string> = { envA: "ATTACK", envD: "DECAY", envS: "SUSTAIN", envR: "RELEASE" };
const SWITCHES = new Set(["pulse", "saw", "sub"]);

export default function Editor() {
  const [{ voice, past, future }, dispatch] = useReducer(history, null, (): History => ({ voice: V.initVoice(), past: [], future: [] }));
  const [libOpen, setLibOpen] = useState(false);
  const [midiOpen, setMidiOpen] = useState(false);
  const [midiSupported, setMidiSupported] = useState<boolean | null>(null);
  const [midi, setMidi] = useState(() => M.status());
  const [inputs, setInputs] = useState<M.PortInfo[]>([]);
  const [msg, setMsg] = useState("");
  const [keysOpen, setKeysOpen] = useState(false); // the keyboard floater
  const [sound, setSound] = useState(false); // the emulator in the browser
  const soundRef = useRef(false);
  // AUDIO: the emulator's output device, as windchime chooses it
  const [audioOpen, setAudioOpen] = useState(false);
  const [audioSupported, setAudioSupported] = useState<boolean | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [wantedDevice, setWantedDevice] = useState<Device>({ id: "", label: "" });
  const [audioMsg, setAudioMsg] = useState("");
  const [library, setLibrary] = useState<Entry[]>([]);
  const restored = useRef(false);

  const edit = useCallback((next: Uint8Array) => dispatch({ type: "edit", voice: next }), []);
  const setValues = useCallback((values: Record<string, number>) => edit(V.setMany(voice, values)), [edit, voice]);
  const val = (key: string): number => V.get(voice, key);

  // ---- persistence: read after mount so the server render matches ----
  useEffect(() => {
    setMidiSupported(M.supported());
    const saved = store.get<string | null>("voice", null);
    if (saved) { try { dispatch({ type: "edit", voice: V.readVoice(fromB64(saved)) }); } catch { /* damaged: keep INIT */ } }
    M.setWanted(store.get("midiIn", ""));
    setLibrary(loadLibrary());
    setKeysOpen(store.get("keys.open", false));
    restored.current = true;
  }, []);
  useEffect(() => { if (restored.current) store.set("voice", toB64(voice)); }, [voice]);
  // every patch change reaches the emulator (a no-op until SOUND has started it); held notes take it at once
  useEffect(() => { A.setVoice(voice); }, [voice]);
  useEffect(() => { if (restored.current) store.set("keys.open", keysOpen); }, [keysOpen]);

  // ---- audio output device ----
  const listDevices = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      // "default" and "communications" are aliases Chrome adds for the system's own choices
      setDevices(all.filter(d => d.kind === "audiooutput" && !["default", "communications"].includes(d.deviceId)).map(d => ({ id: d.deviceId, label: d.label })));
    } catch { setDevices([]); }
  }, []);
  useEffect(() => {
    const ok = A.deviceChoiceSupported() && !!navigator.mediaDevices?.enumerateDevices;
    setAudioSupported(ok);
    const w = store.get<Partial<Device> | null>("audioOut", null);
    if (w && typeof w.id === "string") setWantedDevice({ id: w.id, label: typeof w.label === "string" ? w.label : "" });
    if (!ok) return;
    listDevices();
    navigator.mediaDevices.addEventListener("devicechange", listDevices);
    return () => navigator.mediaDevices.removeEventListener("devicechange", listDevices);
  }, [listDevices]);
  // the device to play on: the wanted one by id, else by name; the system default while it is unplugged. While the
  // browser hides device names (no media permission yet) the list can't be read, so the remembered id is tried as is.
  const namesHidden = !!audioSupported && devices.every(d => !d.label);
  const liveDevice = wantedDevice.id
    ? devices.find(d => d.id === wantedDevice.id) || (wantedDevice.label ? devices.find(d => d.label === wantedDevice.label) : undefined)
    : undefined;
  const deviceGone = !!audioSupported && !!wantedDevice.id && !namesHidden && !liveDevice;
  const sinkId = !audioSupported || !wantedDevice.id ? "" : liveDevice ? liveDevice.id : namesHidden ? wantedDevice.id : "";
  useEffect(() => {
    if (!audioSupported) return;
    A.setDevice(sinkId).catch(e => setAudioMsg(`THAT DEVICE WOULD NOT OPEN${e instanceof Error && e.message ? `: ${e.message}` : ""}.`));
  }, [audioSupported, sinkId]);
  function chooseDevice(v: string) {
    setAudioMsg("");
    const d = v === "default" ? { id: "", label: "" } : devices.find(x => x.id === v);
    if (!d) return;
    setWantedDevice(d);
    store.set("audioOut", d);
  }
  // Browsers only reveal device names after media permission; asking once for the microphone shows them.
  async function onShowNames() {
    setAudioMsg("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      await listDevices();
    } catch {
      setAudioMsg("THE BROWSER KEPT DEVICE NAMES HIDDEN. ALLOW THE MICROPHONE FOR THIS PAGE TO SEE THEM.");
    }
  }
  const deviceValue = !wantedDevice.id ? "default" : liveDevice ? liveDevice.id : "wanted";
  const deviceText = !wantedDevice.id ? "SYSTEM DEFAULT" : liveDevice ? deviceName(liveDevice) : `${deviceName(wantedDevice)}${namesHidden ? "" : "   DISCONNECTED"}`;

  const updateLibrary = useCallback((fn: (list: Entry[]) => Entry[]) => setLibrary(list => { const next = fn(list); saveLibrary(next); return next; }), []);

  // Start the emulator inside the current click or key press. Also used by the keyboard floater and MIDI IN.
  const startSound = useCallback(async (): Promise<boolean> => {
    if (soundRef.current) return true;
    if (!A.supported()) { setMsg("THIS BROWSER CAN'T RUN THE EMULATOR (NO AUDIO WORKLET)."); return false; }
    try {
      await A.start();
      soundRef.current = true; setSound(true);
      return true;
    } catch (e) {
      setMsg(`THE EMULATOR WOULD NOT START${e instanceof Error && e.message ? `: ${e.message}` : ""}.`);
      return false;
    }
  }, []);
  async function onSound() {
    if (!soundRef.current) { await startSound(); return; }
    soundRef.current = false; setSound(false);
    router.allOff();
    await A.stop();
  }

  // ---- MIDI IN ----
  useEffect(() => {
    M.handleNotes(n => router.noteOn(n), n => router.noteOff(n));
    return M.onChange(() => {
      const s = M.status();
      setMidi(s);
      setInputs(M.listInputs());
      if (s.wanted) store.set("midiIn", s.wanted);
    });
  }, []);
  async function onConnect() {
    setMsg("");
    try { await M.connect(); } catch (e) { setMsg(e instanceof Error && e.message ? e.message : "MIDI ACCESS WAS REFUSED."); }
  }

  // audition from the computer keyboard, unless typing in a field
  useEffect(() => {
    const held = new Set<number>();
    const typing = (e: KeyboardEvent): boolean => e.target instanceof Element && !!e.target.closest("input, textarea, [role=combobox], [role=slider], [role=listbox]");
    const down = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || typing(e)) return;
      const n = KEYS[e.key.toLowerCase()];
      if (n === undefined || held.has(n)) return;
      held.add(n);
      if (!soundRef.current) void startSound();
      router.noteOn(n);
    };
    const up = (e: KeyboardEvent) => { const n = KEYS[e.key.toLowerCase()]; if (n !== undefined && held.delete(n)) router.noteOff(n); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); held.forEach(n => router.noteOff(n)); };
  }, [startSound]);

  // undo / redo: Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z" || (e.target instanceof Element && e.target.closest("input"))) return;
      e.preventDefault();
      dispatch({ type: e.shiftKey ? "redo" : "undo" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const name = V.getName(voice);
  const row = (r: string | { key: string; info: HelpKey }) => {
    const key = typeof r === "string" ? r : r.key, info = typeof r === "string" ? undefined : r.info;
    const field = V.voiceField(key);
    if (SWITCHES.has(key)) return <Check key={key} checked={val(key) === 1} onChange={v => setValues({ [key]: v ? 1 : 0 })}>{field.label}</Check>;
    // the HPF is a slider with four positions on the panel
    if (key === "hpf") return (
      <Param key={key} id="p-hpf" label={field.label} value={val(key)}>
        <ParamSlider id="p-hpf" value={val(key)} onChange={v => setValues({ hpf: v })} min={0} max={3} step={1} ticks />
      </Param>
    );
    return <FieldRow key={key} id={`p-${key}`} field={field} value={val(key)} onChange={v => setValues({ [key]: v })} label={ENV_LABELS[key] ?? field.label} {...(info ? { info } : {})} />;
  };
  const chorus = val("chorus"); // 0 off, 1 I, 2 II, 3 I+II: the two buttons as bits

  return (
    <main className="mx-auto grid max-w-[1180px] gap-5">
      <header className="flex flex-wrap items-center gap-2.5">
        <h1 className={H2}>JUNO-60</h1>
        <Leader className="min-w-6" />
        <label className="flex items-center gap-2">
          <span id="name-label" className={SMALL}>NAME</span>
          <input
            aria-labelledby="name-label" value={name} maxLength={V.NAME_LENGTH} spellCheck={false}
            onChange={e => edit(V.setName(voice, e.target.value))}
            className="h-8 w-[20ch] border border-foreground bg-background px-2 tracking-[.06em] outline-none focus-visible:outline-1 focus-visible:outline-offset-3 focus-visible:outline-dashed touch:text-[16px]"
          />
        </label>
        <Button onClick={() => dispatch({ type: "undo" })} disabled={!past.length}>UNDO</Button>
        <Button onClick={() => dispatch({ type: "redo" })} disabled={!future.length}>REDO</Button>
        <Button onClick={() => edit(V.initVoice())}>INIT</Button>
        <span className="flex items-center gap-1.5"><Button aria-pressed={sound} onClick={onSound}>SOUND</Button><Info k="sound" /></span>
        <span className="flex items-center gap-1.5"><Button aria-pressed={keysOpen} onClick={() => setKeysOpen(k => !k)}>KEYS</Button><Info k="keys" /></span>
        <Dialog open={audioOpen} onOpenChange={setAudioOpen}>
          <DialogTrigger asChild>
            <Button className="touch:hidden">AUDIO</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <div className="flex items-baseline gap-2">
                <DialogTitle>AUDIO OUT</DialogTitle>
                <Leader />
                <DialogClose asChild><Button>CLOSE</Button></DialogClose>
              </div>
              <DialogDescription className={NOTE}>Play the emulator through any audio device. SOUND turns it on.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3.5">
              <Param id="a-dev" label="DEVICE" value={deviceGone ? "DISCONNECTED" : sinkId ? "CHOSEN" : "DEFAULT"}>
                <ParamSelect id="a-dev" value={deviceValue} display={deviceText} onChange={chooseDevice} disabled={!audioSupported}>
                  <SelectItem value="default">SYSTEM DEFAULT</SelectItem>
                  {deviceValue === "wanted" && <SelectItem value="wanted" disabled>{deviceText}</SelectItem>}
                  {!namesHidden && devices.map(d => <SelectItem key={d.id} value={d.id}>{deviceName(d)}</SelectItem>)}
                </ParamSelect>
              </Param>
              {namesHidden && (
                <div className={ROW}>
                  <Button onClick={onShowNames}>SHOW DEVICE NAMES</Button>
                  <span className={`${NOTE} min-w-0`}>The browser shows device names only after you allow the microphone once. Nothing is recorded.</span>
                </div>
              )}
              {audioSupported === false && <p className={NOTE}>THIS BROWSER PLAYS THROUGH THE SYSTEM OUTPUT. CHOOSE THE DEVICE IN YOUR SYSTEM SETTINGS.</p>}
              {audioMsg && <p className={NOTE}>{audioMsg}</p>}
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={midiOpen} onOpenChange={setMidiOpen}>
          <DialogTrigger asChild>
            <Button data-live={midi.input ? true : undefined} className="data-[live]:bg-foreground data-[live]:text-background">MIDI</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <div className="flex items-baseline gap-2">
                <DialogTitle>MIDI IN</DialogTitle>
                <Info k="midi" />
                <Leader />
                <DialogClose asChild><Button>CLOSE</Button></DialogClose>
              </div>
              <DialogDescription className={NOTE}>Play the emulator from a keyboard or sequencer. The Juno-60 itself has no MIDI, so nothing is sent.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3.5">
              {!midi.connected ? (
                <div className={ROW}>
                  <Button onClick={onConnect} disabled={midiSupported === false}>CONNECT MIDI</Button>
                  {midiSupported === false && <span className={NOTE}>This browser has no Web MIDI. Use Chrome or Edge on a computer.</span>}
                </div>
              ) : (
                <>
                  <Param id="m-in" label="MIDI IN" value={midi.input ? "OPEN" : "NONE"}>
                    <ParamSelect id="m-in" value={midi.input ? midi.input.id : "none"} display={midi.input ? portName(midi.input) : "NONE"} onChange={v => M.select(v === "none" ? "" : v)}>
                      <SelectItem value="none">NONE</SelectItem>
                      {!midi.input && midi.wanted && <SelectItem value="wanted" disabled>{midi.wanted.toUpperCase()}   DISCONNECTED</SelectItem>}
                      {inputs.map(p => <SelectItem key={p.id} value={p.id}>{portName(p)}</SelectItem>)}
                    </ParamSelect>
                  </Param>
                  <p className={NOTE}>Notes on every channel play the emulator; SOUND must be on.</p>
                  {!inputs.length && <p className={NOTE}>No MIDI inputs found. Plug in a keyboard or interface.</p>}
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
        <span className="flex items-center gap-1.5"><Button onClick={() => setLibOpen(true)}>LIBRARY</Button><Info k="library" /></span>
      </header>

      {msg && <p role="status" className={`${NOTE} max-w-none`}>{msg}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PANEL.map(s => (
          <section key={s.title} aria-label={s.title} className={`grid content-start gap-3.5 border border-foreground p-3 ${s.title === "DCO" ? "lg:row-span-2" : ""}`}>
            <div className="flex items-baseline gap-2"><h2 className={H2}>{s.title}</h2><Info k={s.info} /><Leader /></div>
            {s.rows.map(row)}
          </section>
        ))}
        <section aria-label="CHORUS" className="grid content-start gap-3.5 border border-foreground p-3">
          <div className="flex items-baseline gap-2"><h2 className={H2}>CHORUS</h2><Info k="chorus" /><Leader /><span>{V.CHORUS_MODES[chorus]}</span></div>
          <div role="group" aria-label="CHORUS BUTTONS" className="flex gap-1.5">
            {([1, 2] as const).map(bit => (
              <Button key={bit} aria-pressed={(chorus & bit) !== 0} className="aria-pressed:bg-foreground aria-pressed:text-background"
                onClick={() => setValues({ chorus: chorus ^ bit })}>{bit === 1 ? "I" : "II"}</Button>
            ))}
          </div>
          <p className={NOTE}>Two buttons, as on the panel: I, II, or both together.</p>
        </section>
      </div>

      <footer className="flex flex-wrap items-baseline gap-3 border-t border-foreground pt-3 text-[11px]">
        <span className="flex items-center gap-1.5"><span className={SMALL}>ABOUT THE PATCH</span><Info k="patch" /></span>
        <Leader />
        <Link href="/changelog" className="text-foreground underline underline-offset-3">CHANGELOG</Link>
        <a href="https://github.com/dblodorn/juno60" target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-3">GITHUB</a>
      </footer>

      {keysOpen && <KeyboardFloater onClose={() => setKeysOpen(false)} ensureSound={startSound} />}
      <Library open={libOpen} onOpenChange={setLibOpen} library={library} updateLibrary={updateLibrary} voice={voice}
        onOpen={bytes => { edit(bytes); setMsg(`OPENED ${V.getName(bytes) || "UNTITLED"}. UNDO GOES BACK TO WHAT WAS HERE.`); }}
        onSaved={m => setMsg(m)} />
    </main>
  );
}

