"use client";

// MENU → COLOPHON: the typeface's credit first (Knif Mono is licensed under A is for fonts' webfont EULA, which asks
// for it), then the design system, then lib/colophon.ts: ABOUT, PRIOR WORK and RESOURCES.

import { TypeCredit } from "@dblodorn/sound-ui";
import { ABOUT, PRIOR_WORK, RESOURCES, type Link } from "@/lib/colophon";

const NOTE = "m-0 max-w-[60ch] text-[11px]";
const ITEM = "grid gap-1 border-t border-dashed border-foreground py-2";
const LINK = "w-fit tracking-[.06em] text-foreground underline underline-offset-3 outline-none focus-visible:outline-1 focus-visible:outline-offset-3 focus-visible:outline-dashed";
const HEAD = "m-0 pt-3 text-[10px] font-normal tracking-[.08em]";

function Links({ title, links }: { title: string; links: Link[] }) {
  if (!links.length) return null;
  return (
    <>
      <li><h3 className={HEAD}>{title}</h3></li>
      {links.map(l => (
        <li key={l.url} className={ITEM}>
          <a href={l.url} target="_blank" rel="noopener noreferrer" className={LINK}>{l.name}</a>
          <p className={NOTE}>{l.text}</p>
        </li>
      ))}
    </>
  );
}

export default function Colophon() {
  return (
    <ul className="m-0 grid list-none p-0">
      <li className={ITEM}>
        <TypeCredit className={LINK} />
        <p className={NOTE}>The editor is set in Knif Mono, licensed from the foundry A is for fonts.</p>
      </li>
      <li className={ITEM}>
        <a href="https://soundsystem.dmbk.io/" target="_blank" rel="noopener noreferrer" className={LINK}>SOUND DESIGN SYSTEM</a>
        <p className={NOTE}>The controls, type and colors this editor shares with Chime and the VZ-10M and DX7 editors.</p>
      </li>
      <li><h3 className={HEAD}>ABOUT</h3></li>
      <li className={ITEM}><p className={NOTE}>{ABOUT}</p></li>
      <Links title="PRIOR WORK" links={PRIOR_WORK} />
      <Links title="RESOURCES" links={RESOURCES} />
    </ul>
  );
}
