// localStorage under the "juno60." namespace. Every call is guarded: private windows and blocked storage
// read as empty and drop writes. Never touch storage at module top level (SSR).

import { DEFAULT_ARPEGGIO, isDefaultArpeggio, readArpeggio, type Arpeggio, type Patch } from "./juno60/codec.ts";

const NS = "juno60.";

export const store = {
  get<T>(k: string, d: T): T { try { const v = localStorage.getItem(NS + k); return v === null ? d : (JSON.parse(v) as T); } catch (e) { return d; } },
  set(k: string, v: unknown): void { try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch (e) {} },
  remove(k: string): void { try { localStorage.removeItem(NS + k); } catch (e) {} },
};

// Library entries keep the patch bytes as base64, the same form the API stores.
export const toB64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));
export const fromB64 = (s: string): Uint8Array => Uint8Array.from(atob(s), c => c.charCodeAt(0));

const newId = (): string => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));

export interface Entry {
  id: string;
  name: string;
  data: string; // base64 of the 42 patch bytes
  arpeggio?: Arpeggio; // left out while it is the default (off); entries saved before arpeggios have none
  savedAt: string; // ISO date
}

export const loadLibrary = (): Entry[] => store.get<Entry[]>("library", []);
export const saveLibrary = (list: Entry[]): void => store.set("library", list);
export const entry = (name: string, p: Patch): Entry => ({
  id: newId(), name, data: toB64(p.data), ...(isDefaultArpeggio(p.arpeggio) ? {} : { arpeggio: p.arpeggio }), savedAt: new Date().toISOString(),
});

// an entry's patch; settings that no longer check read as the default
export function patchOf(e: Entry): Patch {
  let arpeggio = DEFAULT_ARPEGGIO;
  if (e.arpeggio) { try { arpeggio = readArpeggio(e.arpeggio); } catch { /* damaged: off */ } }
  return { data: fromB64(e.data), arpeggio };
}
