"use client";

// The parameter-row vocabulary from @dblodorn/sound-ui (LABEL ....... value, the control beneath, named by
// `${id}-label`), with `info` taking a lib/help.ts key for its (?).

import type { ReactNode } from "react";
import * as UI from "@dblodorn/sound-ui";
import type { Field } from "@dblodorn/roland-juno60-engine";
import type { HelpKey } from "../lib/help";
import Info from "./Info";

export const NOTE = "m-0 max-w-[60ch] text-[11px]";
export const ROW = "mt-2 flex flex-wrap items-center gap-2.5";
export const SMALL = "text-[10px] tracking-[.08em]";
export const H2 = "m-0 text-[11px] font-normal tracking-[.08em]";
export { ParamSelect, ParamSlider } from "@dblodorn/sound-ui";

const info = (k?: HelpKey) => (k ? <Info k={k} /> : undefined);

export function Param({ info: k, ...props }: { id: string; label: ReactNode; value: ReactNode; info?: HelpKey; children?: ReactNode }) {
  return <UI.Param {...props} info={info(k)} />;
}

export function Check({ info: k, ...props }: { checked: boolean; onChange: (v: boolean) => void; info?: HelpKey; children: ReactNode }) {
  return <UI.Check {...props} info={info(k)} />;
}

// A row for one field of params.ts: a select for fields with options, else a slider showing the panel reading.
export function FieldRow({ info: k, ...props }: { id: string; field: Field; value: number; onChange: (v: number) => void; label?: string; info?: HelpKey }) {
  return <UI.FieldRow {...props} info={info(k)} />;
}
