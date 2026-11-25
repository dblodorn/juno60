"use client";

// The SHARED tab, from vz10m's: the public list of Juno-60 patches anyone has saved through the dmbk GraphQL API
// (lib/relay/environment.ts → app/api/graphql; dmbk-graphql-api's juno60-voices; Roland's 56 factory patches are among them), and saving, renaming, updating and deleting your own. "Yours" means saved with this
// browser's device key (lib/device.ts); the API marks them with `yours(creatorKey)`. Loaded with next/dynamic when
// the tab is first opened, so Relay and every request stay off the page until then.

import { Component, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { ConnectionHandler, RelayEnvironmentProvider, graphql, useFragment, useLazyLoadQuery, useMutation, usePaginationFragment } from "react-relay";
import type { RecordSourceSelectorProxy } from "relay-runtime";
import { relayEnvironment } from "../lib/relay/environment";
import { problem, refusedName } from "../lib/relay/problem";
import * as D from "../lib/device";
import * as V from "../lib/juno60/codec";
import { isNameAllowed } from "../lib/juno60/names";
import { fromB64, toB64 } from "../lib/store";
import { NOTE, ROW, SMALL } from "./params";
import type { SharedQuery } from "./__generated__/SharedQuery.graphql";
import type { SharedPaginationQuery } from "./__generated__/SharedPaginationQuery.graphql";
import type { Shared_list$key } from "./__generated__/Shared_list.graphql";
import type { Shared_row$data, Shared_row$key } from "./__generated__/Shared_row.graphql";
import type { SharedSaveMutation, SharedSaveMutation$data } from "./__generated__/SharedSaveMutation.graphql";
import type { SharedUpdateMutation } from "./__generated__/SharedUpdateMutation.graphql";
import type { SharedDeleteMutation } from "./__generated__/SharedDeleteMutation.graphql";
import { Badge, Button, Leader } from "@dblodorn/sound-ui";

const PAGE = 20;
const NAME_MAX = V.NAME_LENGTH;


const ListQuery = graphql`
  query SharedQuery($count: Int, $cursor: String, $creatorKey: String, $search: String, $yoursKey: String!) {
    ...Shared_list @arguments(count: $count, cursor: $cursor, creatorKey: $creatorKey, search: $search, yoursKey: $yoursKey)
  }
`;

const ListFragment = graphql`
  fragment Shared_list on Query
  @refetchable(queryName: "SharedPaginationQuery")
  @argumentDefinitions(
    count: { type: "Int", defaultValue: 20 }
    cursor: { type: "String" }
    creatorKey: { type: "String" }
    search: { type: "String" }
    yoursKey: { type: "String!" }
  ) {
    dmbkSoundJuno60Voices(first: $count, after: $cursor, creatorKey: $creatorKey, search: $search)
    @connection(key: "Shared_dmbkSoundJuno60Voices", filters: ["creatorKey", "search"]) {
      __id
      edges {
        node {
          id
          ...Shared_row @arguments(yoursKey: $yoursKey)
        }
      }
    }
  }
`;

const RowFragment = graphql`
  fragment Shared_row on Juno60Voice @argumentDefinitions(yoursKey: { type: "String!" }) {
    id
    name
    data
    arpeggio { version on mode range rate }
    createdAt
    updatedAt
    yours(creatorKey: $yoursKey)
  }
`;

const SaveMutation = graphql`
  mutation SharedSaveMutation($input: DmbkSoundSaveJuno60VoiceInput!, $yoursKey: String!) {
    dmbkSoundSaveJuno60Voice(input: $input) {
      created
      juno60VoiceEdge {
        cursor
        node {
          id
          name
          ...Shared_row @arguments(yoursKey: $yoursKey)
        }
      }
    }
  }
`;

const UpdateMutation = graphql`
  mutation SharedUpdateMutation($input: DmbkSoundUpdateJuno60VoiceInput!, $yoursKey: String!) {
    dmbkSoundUpdateJuno60Voice(input: $input) {
      juno60Voice {
        id
        name
        ...Shared_row @arguments(yoursKey: $yoursKey)
      }
    }
  }
`;

const DeleteMutation = graphql`
  mutation SharedDeleteMutation($input: DmbkSoundDeleteJuno60VoiceInput!, $connections: [ID!]!) {
    dmbkSoundDeleteJuno60Voice(input: $input) {
      deletedJuno60VoiceId @deleteEdge(connections: $connections)
    }
  }
`;


const date = (iso: string): string => iso.slice(0, 10);
const bytesOf = (data: string): Uint8Array | null => {
  try { const b = fromB64(data); return b.length === V.VOICE_BYTES ? b : null; } catch { return null; }
};
// a row's arpeggiator settings: none (or settings this editor can't read) is the default, off
const arpeggioOf = (a: Shared_row$data["arpeggio"]): V.Arpeggio => {
  try { return a ? V.readArpeggio({ ...a }) : V.DEFAULT_ARPEGGIO; } catch { return V.DEFAULT_ARPEGGIO; }
};
// what the API takes: null for the default, which it stores as none
const arpeggioInput = (a: V.Arpeggio) => (V.isDefaultArpeggio(a) ? null : { version: a.version, on: a.on, mode: a.mode, range: a.range, rate: a.rate });

// The saved patch goes on top of the list being shown, unless that list already has it (a repeat save) or
// is a search the name might not match.
function prependSaved(connectionId: string | null, search: boolean) {
  return (store: RecordSourceSelectorProxy<SharedSaveMutation$data>) => {
    if (search) return;
    const payload = store.getRootField("dmbkSoundSaveJuno60Voice");
    const edge = payload?.getLinkedRecord("juno60VoiceEdge");
    const node = edge?.getLinkedRecord("node");
    const conn = connectionId ? store.get(connectionId) : null;
    if (!edge || !node || !conn) return;
    const edges = conn.getLinkedRecords("edges") || [];
    if (edges.some(e => e?.getLinkedRecord("node")?.getDataID() === node.getDataID())) return;
    const built = ConnectionHandler.buildConnectionEdge(store, conn, edge);
    if (built) ConnectionHandler.insertEdgeBefore(conn, built);
  };
}

interface RowActions {
  patch: V.Patch;
  yoursKey: string;
  connectionId: string;
  onOpen: (p: V.Patch) => void;
  onSaveLocal: (p: V.Patch) => void;
  say: (msg: string) => void;
}

function Row({ row, patch, yoursKey, connectionId, onOpen, onSaveLocal, say }: RowActions & { row: Shared_row$data }) {
  const [commitUpdate, updating] = useMutation<SharedUpdateMutation>(UpdateMutation);
  const [commitDelete, deleting] = useMutation<SharedDeleteMutation>(DeleteMutation);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"update" | "delete" | null>(null);
  const bytes = bytesOf(row.data);
  const saved: V.Patch | null = bytes ? { data: bytes, arpeggio: arpeggioOf(row.arpeggio) } : null;
  const busy = updating || deleting;

  function update(p: V.Patch, doing: string, done: string) {
    const name = V.getName(p.data);
    if (!isNameAllowed(name)) { say(refusedName(name)); return; }
    commitUpdate({
      variables: { input: { id: row.id, data: toB64(p.data), arpeggio: arpeggioInput(p.arpeggio), creatorKey: yoursKey }, yoursKey },
      onCompleted: () => { say(done); setRenaming(null); },
      onError: err => say(problem(err, doing)),
    });
  }

  return (
    <li className="grid gap-1 border-t border-dashed border-foreground py-2">
      <div className="flex items-baseline gap-2">
        <span className="tracking-[.06em]">{row.name || "UNTITLED"}</span>
        {row.yours && <Badge title="SAVED FROM THIS DEVICE">YOURS</Badge>}
        <Leader />
        <time dateTime={row.updatedAt} className={SMALL}>{date(row.updatedAt)}</time>
      </div>
      {renaming !== null ? (
        <form className="flex flex-wrap gap-1.5" onSubmit={e => { e.preventDefault(); if (saved) update({ ...saved, data: V.setName(saved.data, renaming) }, "RENAME", `RENAMED TO ${renaming.trim() || "UNTITLED"}.`); }}>
          <input
            aria-label={`NEW NAME FOR ${row.name}`} autoFocus maxLength={NAME_MAX} value={renaming}
            onChange={e => setRenaming(e.target.value)}
            onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); setRenaming(null); } }}
            className="h-8 w-[20ch] border border-foreground bg-background px-2 outline-none focus-visible:outline-1 focus-visible:outline-offset-3 focus-visible:outline-dashed touch:text-[16px]"
          />
          <Button type="submit" disabled={busy}>{updating ? "SAVING…" : "SAVE NAME"}</Button>
          <Button type="button" onClick={() => setRenaming(null)}>CANCEL</Button>
        </form>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          <Button disabled={!saved} onClick={() => saved && onOpen(saved)}>OPEN</Button>
          <Button disabled={!saved} onClick={() => saved && onSaveLocal(saved)}>SAVE TO LOCAL</Button>
          {row.yours && (
            <>
              <Button disabled={busy || !bytes} onClick={() => setRenaming(row.name)}>RENAME</Button>
              <Button
                disabled={busy} aria-pressed={confirm === "update"}
                onBlur={() => setConfirm(c => (c === "update" ? null : c))}
                onClick={() => {
                  if (confirm !== "update") { setConfirm("update"); return; }
                  setConfirm(null);
                  update(patch, "UPDATE", `UPDATED WITH THE PATCH YOU'RE EDITING.`);
                }}
              >{confirm === "update" ? "REPLACE WITH CURRENT?" : updating ? "SAVING…" : "UPDATE"}</Button>
              <Button
                disabled={busy} aria-pressed={confirm === "delete"}
                onBlur={() => setConfirm(c => (c === "delete" ? null : c))}
                onClick={() => {
                  if (confirm !== "delete") { setConfirm("delete"); return; }
                  setConfirm(null);
                  commitDelete({
                    variables: { input: { id: row.id, creatorKey: yoursKey }, connections: [connectionId] },
                    onCompleted: () => say(`DELETED ${row.name || "UNTITLED"} FROM THE SHARED LIST.`),
                    onError: err => say(problem(err, "DELETE")),
                  });
                }}
              >{confirm === "delete" ? "CONFIRM DELETE" : deleting ? "DELETING…" : "DELETE"}</Button>
            </>
          )}
        </div>
      )}
    </li>
  );
}

function RowItem({ node, ...actions }: RowActions & { node: Shared_row$key }) {
  // fragment data is read here so each row only re-renders on its own changes
  return <Row row={useFragment<Shared_row$key>(RowFragment, node)} {...actions} />;
}

interface Filters { creatorKey: string | null; search: string | null; yoursKey: string }

function List({ filters, fetchKey, onConnection, ...actions }: Omit<RowActions, "connectionId" | "yoursKey"> & { filters: Filters; fetchKey: string; onConnection: (id: string) => void }) {
  const query = useLazyLoadQuery<SharedQuery>(ListQuery, { count: PAGE, ...filters }, { fetchKey, fetchPolicy: "store-and-network" });
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<SharedPaginationQuery, Shared_list$key>(ListFragment, query);
  const [nextFailed, setNextFailed] = useState(false);
  const connectionId = data.dmbkSoundJuno60Voices.__id;
  useEffect(() => { onConnection(connectionId); }, [connectionId, onConnection]);
  const edges = data.dmbkSoundJuno60Voices.edges;
  const more = () => { setNextFailed(false); loadNext(PAGE, { onComplete: err => { if (err) setNextFailed(true); } }); };
  return (
    <>
      {edges.length === 0 ? (
        <p className={NOTE}>{filters.search ? `NO SHARED PATCH NAMED ${filters.search}.` : filters.creatorKey ? "YOU HAVEN'T SHARED A PATCH FROM THIS DEVICE YET." : "NOTHING SHARED YET."}</p>
      ) : (
        <ul className="m-0 grid list-none p-0">
          {edges.map(e => <RowItem key={e.node.id} node={e.node} connectionId={connectionId} yoursKey={filters.yoursKey} {...actions} />)}
        </ul>
      )}
      {nextFailed && <p className={NOTE}>COULD NOT LOAD MORE.</p>}
      {hasNext && <Button className="w-full" onClick={more} disabled={isLoadingNext}>{isLoadingNext ? "LOADING…" : nextFailed ? "RETRY" : "MORE"}</Button>}
    </>
  );
}

class LoadFailed extends Component<{ children: ReactNode; onRetry: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="grid gap-2">
        <p className={NOTE}>COULD NOT LOAD THE SHARED LIST.</p>
        <Button onClick={this.props.onRetry}>RETRY</Button>
      </div>
    );
  }
}

function Save({ patch, yoursKey, connection, onKey, say }: { patch: V.Patch; yoursKey: string; connection: () => { id: string | null; search: boolean }; onKey: (k: string) => void; say: (m: string) => void }) {
  const [commit, saving] = useMutation<SharedSaveMutation>(SaveMutation);
  const onSave = () => {
    const name = V.getName(patch.data);
    if (!isNameAllowed(name)) { say(refusedName(name)); return; }
    const key = yoursKey || D.ensureKey();
    if (key !== yoursKey) onKey(key);
    commit({
      variables: { input: { data: toB64(patch.data), arpeggio: arpeggioInput(patch.arpeggio), creatorKey: key }, yoursKey: key },
      updater: (store: RecordSourceSelectorProxy<SharedSaveMutation$data>) => { const c = connection(); prependSaved(c.id, c.search)(store); },
      onCompleted: res => say(res.dmbkSoundSaveJuno60Voice.created ? `SHARED ${name || "UNTITLED"}.` : `${name || "UNTITLED"} IS ALREADY IN THE SHARED LIST.`),
      onError: err => say(problem(err, "SAVE")),
    });
  };
  return <Button onClick={onSave} disabled={saving}>{saving ? "SAVING…" : "SHARE CURRENT"}</Button>;
}

function DeviceKey({ yoursKey, onKey }: { yoursKey: string; onKey: (k: string) => void }) {
  const [shown, setShown] = useState(false);
  const [paste, setPaste] = useState("");
  const [msg, setMsg] = useState("");
  return (
    <details className="border-t border-foreground pt-2">
      <summary className={`${SMALL} cursor-pointer`}>DEVICE KEY</summary>
      <div className="mt-2 grid gap-2">
        <p className={NOTE}>
          This key is what makes a shared patch yours: with it you can rename, update and delete what you shared. It is
          kept only in this browser, and the server stores only a hash of it. Copy it to another browser to manage your
          patches there too. Anyone with it can change them, so keep it private. Clearing this site&apos;s data without a
          copy loses it, and your shared patches stay public.
        </p>
        {yoursKey ? (
          <div className={ROW + " mt-0"}>
            <code className="min-w-0 flex-1 truncate text-[11px]">{shown ? yoursKey : "•".repeat(20)}</code>
            <Button onClick={() => setShown(s => !s)}>{shown ? "HIDE" : "SHOW"}</Button>
            <Button onClick={() => navigator.clipboard.writeText(yoursKey).then(() => setMsg("KEY COPIED."), () => setMsg("COULD NOT COPY. SHOW IT AND COPY BY HAND."))}>COPY</Button>
          </div>
        ) : <p className={NOTE}>No key yet: one is made the first time you share a patch.</p>}
        <form className={ROW + " mt-0"} onSubmit={e => {
          e.preventDefault();
          if (!D.useKey(paste)) { setMsg("THAT ISN'T A DEVICE KEY (43 LETTERS, DIGITS, - AND _)."); return; }
          onKey(paste.trim()); setPaste(""); setMsg("THIS BROWSER NOW USES THAT KEY.");
        }}>
          <input
            aria-label="PASTE A DEVICE KEY" placeholder="PASTE A KEY FROM ANOTHER BROWSER" value={paste} onChange={e => setPaste(e.target.value)}
            className="h-8 min-w-0 flex-1 border border-foreground bg-background px-2 text-[11px] outline-none focus-visible:outline-1 focus-visible:outline-offset-3 focus-visible:outline-dashed touch:text-[16px]"
          />
          <Button type="submit" disabled={!paste.trim()}>USE KEY</Button>
        </form>
        {yoursKey && <p className={NOTE}>Using another key replaces this one here. Copy this one first if you still need it.</p>}
        {msg && <p role="status" className={NOTE}>{msg}</p>}
      </div>
    </details>
  );
}

interface Props {
  patch: V.Patch;
  onOpen: (p: V.Patch) => void;
  onSaveLocal: (p: V.Patch) => void;
}

export default function Shared({ patch, onOpen, onSaveLocal }: Props) {
  const [yoursKey, setYoursKey] = useState("");
  const [mine, setMine] = useState(false);
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [retries, setRetries] = useState(0);
  const [msg, setMsg] = useState("");
  const connectionId = useRef<string | null>(null);

  useEffect(() => { setYoursKey(D.readKey() ?? ""); }, []);
  // search as you type, after a pause
  useEffect(() => {
    const t = setTimeout(() => setSearch(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);

  const filters: Filters = { creatorKey: mine && yoursKey ? yoursKey : null, search: search || null, yoursKey };
  const fetchKey = String(retries);
  const onConnection = (id: string) => { connectionId.current = id; };

  return (
    <RelayEnvironmentProvider environment={relayEnvironment()}>
      <div className={ROW + " mt-0"}>
        <Save patch={patch} yoursKey={yoursKey} connection={() => ({ id: connectionId.current, search: !!search })} onKey={setYoursKey} say={setMsg} />
      </div>
      {msg && <p role="status" className={NOTE}>{msg}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="SHOW" className="flex gap-1.5">
          <Button aria-pressed={!mine} onClick={() => setMine(false)}>ALL</Button>
          <Button aria-pressed={mine} disabled={!yoursKey} onClick={() => setMine(true)}>YOURS</Button>
        </div>
        <label className="flex min-w-[12rem] flex-1 items-center gap-2">
          <span id="shared-search-label" className={SMALL}>SEARCH</span>
          <input
            type="search" aria-labelledby="shared-search-label" maxLength={NAME_MAX} value={text} onChange={e => setText(e.target.value.toUpperCase())}
            className="h-8 min-w-0 flex-1 border border-foreground bg-background px-2 uppercase outline-none focus-visible:outline-1 focus-visible:outline-offset-3 focus-visible:outline-dashed touch:text-[16px]"
          />
        </label>
      </div>
      <LoadFailed key={fetchKey} onRetry={() => setRetries(n => n + 1)}>
        <Suspense fallback={<p className={NOTE}>LOADING…</p>}>
          <List filters={filters} fetchKey={fetchKey} onConnection={onConnection} patch={patch} onOpen={onOpen} onSaveLocal={onSaveLocal} say={setMsg} />
        </Suspense>
      </LoadFailed>
      <DeviceKey yoursKey={yoursKey} onKey={k => { setYoursKey(k); setMsg(""); }} />
    </RelayEnvironmentProvider>
  );
}
