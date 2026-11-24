"use client";

// LIBRARY: a sheet on the right with tabs. LOCAL: patches kept in this browser (save, open, delete, search, .json
// in and out). COLOPHON: the typeface, the design system, ABOUT, PRIOR WORK and RESOURCES (components/Colophon.tsx).
// Loaded with next/dynamic the first time LIBRARY is pressed.

import { useEffect, useRef, useState } from "react";
import { Button, Leader, Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, Tabs, tabPanelProps } from "@dblodorn/sound-ui";
import * as V from "../lib/juno60/codec";
import { entry, fromB64, store, type Entry } from "../lib/store";
import { download, fileName } from "../lib/files";
import Colophon from "./Colophon";
import Info from "./Info";
import { NOTE, ROW, SMALL } from "./params";

const TABS = [{ value: "local", label: "LOCAL" }, { value: "colophon", label: "COLOPHON" }] as const;
type Tab = (typeof TABS)[number]["value"];

const date = (iso: string): string => iso.slice(0, 10);

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  library: Entry[];
  updateLibrary: (fn: (list: Entry[]) => Entry[]) => void;
  voice: Uint8Array;
  onOpen: (bytes: Uint8Array) => void;
  onSaved: (msg: string) => void;
}

export default function Library({ open, onOpenChange, library, updateLibrary, voice, onOpen }: Props) {
  const [tab, setTab] = useState<Tab>("local");
  const [msg, setMsg] = useState("");
  const [query, setQuery] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null); // id awaiting a second press of DELETE
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = store.get<string>("library.tab", "local");
    setTab(TABS.some(x => x.value === t) ? (t as Tab) : "local");
  }, []);
  const chooseTab = (t: Tab) => { setTab(t); setMsg(""); store.set("library.tab", t); };

  function saveCurrent() {
    const name = V.getName(voice) || "UNTITLED";
    updateLibrary(list => [entry(name, voice), ...list]);
    setMsg(`SAVED ${name}.`);
  }

  async function onFiles(files: File[]) {
    const added: Uint8Array[] = [], problems: string[] = [];
    for (const f of files) {
      try { added.push(...V.fromFile(await f.text())); } catch (e) { problems.push(`${f.name.toUpperCase()}: ${e instanceof Error ? e.message : "UNREADABLE."}`); }
    }
    if (added.length) updateLibrary(list => [...added.map(p => entry(V.getName(p) || "UNTITLED", p)), ...list]);
    setMsg([added.length && `ADDED ${added.length} PATCH${added.length === 1 ? "" : "ES"}.`, ...problems].filter(Boolean).join(" "));
  }

  const q = query.trim().toUpperCase();
  const shown = q ? library.filter(e => e.name.toUpperCase().includes(q)) : library;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby="lib-desc" className="w-[min(480px,100vw)]">
        <SheetHeader>
          <SheetTitle>LIBRARY</SheetTitle>
          <Info k="library" />
          <Leader />
          <SheetClose asChild><Button>CLOSE</Button></SheetClose>
        </SheetHeader>
        <Tabs label="LIBRARY" idPrefix="lib" tabs={TABS} value={tab} onChange={chooseTab} />
        <SheetDescription id="lib-desc" className={NOTE}>
          {tab === "local" ? "Kept in this browser. Export and import .json files to move patches between machines."
            : "The typeface and the design system, what this editor is for, the work it builds on, then pages elsewhere about the Juno-60. Links open in a new tab."}
        </SheetDescription>
        <div {...tabPanelProps("lib", "colophon", tab)}><Colophon /></div>
        <div {...tabPanelProps("lib", "local", tab)} className="grid gap-3.5 [&[hidden]]:hidden">
          <div className={ROW + " mt-0"}>
            <Button onClick={saveCurrent}>SAVE CURRENT</Button>
            <Button onClick={() => fileRef.current?.click()}>IMPORT .JSON</Button>
            <Button disabled={!library.length} onClick={() => download(V.toFile(library.map(e => fromB64(e.data))), "juno60-library.json")}>EXPORT ALL</Button>
            <input ref={fileRef} type="file" accept=".json,application/json" multiple hidden onChange={e => { onFiles([...(e.target.files ?? [])]); e.target.value = ""; }} />
          </div>
          {msg && <p role="status" className={NOTE}>{msg}</p>}
          <label className="flex items-center gap-2">
            <span id="lib-search-label" className={SMALL}>SEARCH</span>
            <input type="search" aria-labelledby="lib-search-label" value={query} onChange={e => setQuery(e.target.value)}
              className="h-8 min-w-0 flex-1 border border-foreground bg-background px-2 uppercase outline-none focus-visible:outline-1 focus-visible:outline-offset-3 focus-visible:outline-dashed touch:text-[16px]" />
          </label>
          {!library.length && <p className={NOTE}>NO PATCHES YET. SAVE CURRENT KEEPS THE ONE YOU'RE EDITING.</p>}
          <ul aria-label="LOCAL PATCHES" className="m-0 grid list-none p-0">
            {shown.map(e => (
              <li key={e.id} className="grid gap-1 border-t border-dashed border-foreground py-2">
                <div className="flex items-center gap-2">
                  <span className="tracking-[.06em]">{e.name}</span>
                  <Leader />
                  <span className={SMALL}>{date(e.savedAt)}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button onClick={() => onOpen(fromB64(e.data))}>OPEN</Button>
                  <Button onClick={() => download(V.toFile([fromB64(e.data)]), fileName(e.name))}>.JSON</Button>
                  <Button onClick={() => {
                    if (confirming !== e.id) { setConfirming(e.id); return; }
                    updateLibrary(list => list.filter(x => x.id !== e.id));
                    setConfirming(null);
                    setMsg(`DELETED ${e.name}.`);
                  }}>{confirming === e.id ? "DELETE?" : "DELETE"}</Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}
