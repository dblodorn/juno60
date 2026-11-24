# Juno-60

A browser editor and librarian for Roland Juno-60 patches, and an approximate emulator to hear them, published as a
package (`@dblodorn/roland-juno60-engine`). Sibling of [dx7](https://github.com/dblodorn/dx7) and
[vz10m](https://github.com/dblodorn/vz10m), and built the same way. Live at https://juno60.dmbk.io.

```
pnpm install   # the editor's design-system packages come from GitHub Packages: needs a read:packages token in ~/.npmrc
pnpm dev
pnpm test
```

Edit a patch on the Juno-60's panel (LFO, DCO, HPF, VCF, VCA, ENV, CHORUS), hear it with SOUND, play it with KEYS,
the Z–M keys or a keyboard on MIDI IN, and keep patches in LIBRARY → LOCAL, with `.json` import and export.

The emulator is an approximate stand-in for the Juno-60, not a replacement for it: some curves are measured from a
real Juno-60 ([Andy Harman's analysis](https://github.com/pendragon-andyh/Juno60)), the rest are estimates. This is an
editor and a way to learn how the Juno-60 makes its sound; LIBRARY → COLOPHON credits the work it builds on.

A stock Juno-60 has no MIDI (it has Roland's DCB port and saves to cassette), so the editor can't send patches to the
instrument yet. Cassette dumps and MIDI retrofit kits are planned.
