// localStorage under the "juno60." namespace. Every call is guarded: private windows and blocked storage
// read as empty and drop writes. Never touch storage at module top level (SSR).

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
  savedAt: string; // ISO date
}

export const loadLibrary = (): Entry[] => store.get<Entry[]>("library", []);
export const saveLibrary = (list: Entry[]): void => store.set("library", list);
export const entry = (name: string, bytes: Uint8Array): Entry =>
  ({ id: newId(), name, data: toB64(bytes), savedAt: new Date().toISOString() });
