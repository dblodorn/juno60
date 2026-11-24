// A library of patches the synth can load from. The dmbk library (dmbk.ts) is one; a host can bring its own by
// implementing this shape over whatever it stores patches in.

export interface PatchSummary {
  id: string;
  name: string;
}

export interface PatchQuery {
  search?: string; // names containing this text
  after?: string; // the `next` of the previous page
  first?: number; // page size
}

export interface PatchPage {
  items: PatchSummary[];
  next: string | null; // pass as `after` for the following page; null on the last page
}

export interface PatchSource {
  list(query?: PatchQuery): Promise<PatchPage>;
  // The patch's 42 bytes, ready for loadVoice().
  get(id: string): Promise<Uint8Array>;
}
