// The shared list is public, so the API refuses obscene patch names (dmbk-graphql-api's
// src/lib/synth-voices/names.ts). This is the same check, run here first so SHARE can say so before a request; the
// API's answer still decides. Keep the whitelist in step with the API's.
import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from "obscenity";

// Real patch names the English set mistakes for obscenities (the API's list, shared by every synth's library)
const WHITELIST = ["analead", "heavyanalead", "sexy"];

let matcher: RegExpMatcher | null = null;

/** "F U C K PAD" → "FUCK PAD"; "AB CD" unchanged. */
export const joinSpelledOut = (name: string): string =>
  name.replace(/\b[A-Za-z0-9](?:[\s._*-]+[A-Za-z0-9]\b)+/g, run => run.replace(/[\s._*-]+/g, ""));

export function isNameAllowed(name: string): boolean {
  if (!matcher) {
    const dataset = englishDataset.build();
    matcher = new RegExpMatcher({ ...dataset, whitelistedTerms: [...(dataset.whitelistedTerms ?? []), ...WHITELIST], ...englishRecommendedTransformers });
  }
  return !matcher.hasMatch(name) && !matcher.hasMatch(joinSpelledOut(name));
}
