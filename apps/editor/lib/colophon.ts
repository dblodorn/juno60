// LIBRARY → COLOPHON, after the typeface's credit and the design system: ABOUT, PRIOR WORK, RESOURCES.
//
// ABOUT: what the app is for. The emulator is an approximate stand-in for the Juno-60; the app is an editor and a
//   way to learn the instrument.
// PRIOR WORK: every project, analysis, measurement, port or reference the code or the sound draws on, with what was
//   taken from it, credited even where no code was copied. A change that adds a source adds its entry here.
// RESOURCES: pages elsewhere that help a player, newest finds last.

export interface Link { name: string; url: string; text: string }

export const ABOUT =
  "An editor and librarian for Juno-60 patches, and a way to learn how the Juno-60 makes its sound. The emulator that plays with SOUND is an approximate stand-in for the instrument, not a replacement for it: some of its curves are measured from a real Juno-60, the rest are estimates.";

export const PRIOR_WORK: Link[] = [
  {
    name: "JUNO60 ANALYSIS (ANDY HARMAN)",
    url: "https://github.com/pendragon-andyh/Juno60",
    text: "Andy Harman's measurements of a Juno-60's envelope, LFO delay, high-pass filter and chorus (MIT). The emulator's measured curves are ported from it.",
  },
  {
    name: "JUNOX (ANDY HARMAN, DANIELE ZANNOTTI)",
    url: "https://github.com/pendragon-andyh/junox",
    text: "A Web Audio emulation of the Juno-60 (GPL-3.0). Its factory patch sheet showed which controls a patch stores and how the panel reads them. No code was taken.",
  },
];

export const RESOURCES: Link[] = [
  {
    name: "ROLAND JUNO-60 (WIKIPEDIA)",
    url: "https://en.wikipedia.org/wiki/Roland_Juno-60",
    text: "The instrument's history and specifications: six voices, one DCO per voice, the chorus, 56 patch memories and the DCB port.",
  },
  {
    name: "JUNOX DEMO",
    url: "https://pendragon-andyh.github.io/junox/",
    text: "JunoX in the browser, with visualisations of its DCO, LFO, envelope and chorus.",
  },
  {
    name: "TAL-U-NO-LX",
    url: "https://tal-software.com/products/tal-u-no-lx",
    text: "A commercial Juno-60 plugin for desktop DAWs, from TAL Software.",
  },
  {
    name: "JUNO-60: THE WHOLE STORY",
    url: "https://articles.roland.com/juno-60-the-whole-story/",
    text: "Roland's article on how the Juno-60 was designed and why it sounds as it does.",
  },
];
