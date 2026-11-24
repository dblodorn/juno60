// Reading a patch: field values, the name, and the check every loaded patch goes through. Nothing here changes a
// patch (writing is the editor's, in apps/editor/lib/juno60/).

import { NAME_BYTE, NAME_LENGTH, VOICE_BYTES, VOICE_FIELDS, voiceField } from "./params.ts";

export const get = (patch: Uint8Array, key: string): number => patch[voiceField(key).byte] ?? 0;

// printable ASCII, trailing spaces trimmed
export function getName(patch: Uint8Array): string {
  let s = "";
  for (let i = 0; i < NAME_LENGTH; i++) {
    const b = patch[NAME_BYTE + i] ?? 0x20;
    s += b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : " ";
  }
  return s.trimEnd();
}

export const displayOf = (patch: Uint8Array, key: string): string => {
  const f = voiceField(key), v = get(patch, key);
  return f.options ? (f.options[v] ?? String(v)) : f.display ? f.display(v) : String(v);
};

// A copy of the patch after checking it: 42 bytes, every field within its range. Throws with the reason.
export function readVoice(bytes: Uint8Array): Uint8Array {
  if (!(bytes instanceof Uint8Array) || bytes.length !== VOICE_BYTES) throw new RangeError(`A Juno-60 patch is ${VOICE_BYTES} bytes, got ${bytes?.length}.`);
  for (const f of VOICE_FIELDS) {
    const v = bytes[f.byte]!;
    if (v < f.min || v > f.max) throw new RangeError(`${f.section} ${f.label} (byte ${f.byte}) must be ${f.min}–${f.max}, got ${v}.`);
  }
  return new Uint8Array(bytes);
}
