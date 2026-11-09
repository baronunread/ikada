/**
 * A KV namespace's keys, filtered by prefix or search, beside the selected key's value,
 * metadata and expiry, with copy and a two-step delete that can be undone.
 * Wide containers put the list and the key side by side; narrow ones stack them.
 */
import { useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Button } from "../../src/components/button";
import { CodeBlock } from "../../src/components/code-block";
import { CopyId } from "../../src/components/copy-id";
import { DescriptionList } from "../../src/components/description-list";
import { InlineConfirm } from "../../src/components/inline-confirm";
import { Input } from "../../src/components/input";
import { SegmentedControl } from "../../src/components/segmented-control";
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from "../../src/components/table";
import { cn, focusRing, pressMotion } from "../../src/lib/cn";
import { formatBytes } from "../../src/lib/format";
import { CheckIcon, KeyIcon, SearchIcon, TrashIcon, UndoIcon } from "../../src/lib/icons";

export interface KvEntry {
  key: string;
  /** The stored value as text; JSON is pretty-printed in the detail pane. */
  value: string;
  /** Optional metadata stored with the key (`put(key, value, { metadata })`). */
  metadata?: Record<string, unknown>;
  /** Seconds until the key expires; omit for keys that never expire. */
  expiresIn?: number;
  /** Seconds since the key was last written. */
  updatedAgo: number;
}

export interface KvBrowserProps {
  /** The namespace name shown in the header. */
  namespace?: string;
  entries?: KvEntry[];
  /** Prefixes offered as quick filters. Defaults to the distinct `prefix:` parts of the keys. */
  prefixes?: string[];
  /** Called after a key is deleted (and again with `restored` when the delete is undone). */
  onDelete?: (key: string, restored?: boolean) => void;
  className?: string;
}

const json = (value: unknown): string => JSON.stringify(value);

/** Sample data: a namespace a small shop's edge code reads for sessions, flags, short links and rate limits. */
export const sampleEntries: KvEntry[] = [
  {
    key: "flag:checkout-v2",
    value: json({ enabled: true, rollout: 0.25, audience: ["beta", "staff"] }),
    metadata: { owner: "payments" },
    updatedAgo: 3 * 3600,
  },
  { key: "flag:dark-mode", value: json({ enabled: true, rollout: 1 }), updatedAgo: 9 * 86400 },
  {
    key: "flag:new-search",
    value: json({ enabled: false, rollout: 0, note: "waiting on index rebuild" }),
    metadata: { owner: "search" },
    updatedAgo: 26 * 3600,
  },
  {
    key: "link:spring-sale",
    value: "https://fernleaf.shop/collections/spring?utm_source=newsletter&utm_campaign=spring-sale",
    metadata: { clicks: 1284 },
    updatedAgo: 4 * 86400,
  },
  {
    key: "link:care-guide",
    value: "https://fernleaf.shop/guides/watering-101",
    metadata: { clicks: 341 },
    updatedAgo: 20 * 86400,
  },
  { key: "link:returns", value: "https://fernleaf.shop/help/returns", updatedAgo: 61 * 86400 },
  {
    key: "rate:203.0.113.42",
    value: json({ count: 87, window: "60s" }),
    expiresIn: 38,
    updatedAgo: 22,
  },
  { key: "rate:198.51.100.7", value: json({ count: 12, window: "60s" }), expiresIn: 51, updatedAgo: 9 },
  {
    key: "session:01J9ZK4Q8M2R",
    value: json({
      user: "u_4821",
      email: "mara@example.com",
      cart: ["monstera-deliciosa", "ceramic-pot-m"],
      theme: "dark",
    }),
    metadata: { ip: "203.0.113.42", ua: "Safari 18" },
    expiresIn: 6 * 3600 + 1200,
    updatedAgo: 4 * 60,
  },
  {
    key: "session:01J9ZM7C3T5W",
    value: json({ user: "u_1093", email: "theo@example.com", cart: [], theme: "light" }),
    metadata: { ip: "198.51.100.7", ua: "Firefox 131" },
    expiresIn: 23 * 3600,
    updatedAgo: 52 * 60,
  },
  {
    key: "session:01J9ZP1D9H0X",
    value: json({ user: "u_2210", email: "ines@example.com", cart: ["pilea-peperomioides"], theme: "system" }),
    expiresIn: 2 * 3600,
    updatedAgo: 3 * 3600,
  },
  {
    key: "stock:monstera-deliciosa",
    value: json({ sku: "PL-0142", available: 18, reserved: 3, warehouse: "lis-1" }),
    expiresIn: 300,
    updatedAgo: 40,
  },
  {
    key: "stock:pilea-peperomioides",
    value: json({ sku: "PL-0087", available: 0, reserved: 0, warehouse: "lis-1", restock: "2026-11-20" }),
    expiresIn: 300,
    updatedAgo: 110,
  },
  {
    key: "config:shipping",
    value: json({ free_over: 60, currency: "EUR", zones: ["PT", "ES", "FR", "DE"] }),
    updatedAgo: 14 * 86400,
  },
];

/** "38 s", "6 h", "9 d": a compact duration for ages and expiries. */
function span(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h`;
  return `${Math.round(seconds / 86400)} d`;
}

const sizeOf = (entry: KvEntry): number => new TextEncoder().encode(entry.key + entry.value).length;

function pretty(text: string): string | null {
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null ? JSON.stringify(parsed, null, 2) : null;
  } catch {
    return null;
  }
}

function prefixesOf(entries: KvEntry[]): string[] {
  const seen = new Set<string>();
  for (const e of entries) {
    const at = e.key.indexOf(":");
    if (at > 0) seen.add(e.key.slice(0, at + 1));
  }
  return [...seen].sort();
}

/** A toggle chip for one quick filter. */
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 font-mono text-sb-xs shadow-[inset_0_0_0_1px_var(--sb-hairline-strong)] pointer-coarse:h-11",
        pressMotion,
        active ? "bg-neutral-soft font-semibold text-fg" : "text-fg-muted hover:bg-hover hover:text-fg",
        focusRing,
      )}
    >
      {active ? <CheckIcon className="size-3" /> : null}
      {children}
    </button>
  );
}

export function KvBrowser({
  namespace = "fernleaf-edge",
  entries: initial = sampleEntries,
  prefixes,
  onDelete,
  className,
}: KvBrowserProps) {
  const [entries, setEntries] = useState(() => [...initial].sort((a, b) => a.key.localeCompare(b.key)));
  const [query, setQuery] = useState("");
  const [prefix, setPrefix] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(() => entries[0]?.key ?? null);
  const [view, setView] = useState<"json" | "text">("json");
  const [armed, setArmed] = useState(false);
  const [deleted, setDeleted] = useState<{ entry: KvEntry; index: number } | null>(null);
  const listRef = useRef<HTMLTableSectionElement>(null);
  const searchId = useId();
  const chips = useMemo(() => prefixes ?? prefixesOf(entries), [prefixes, entries]);

  const needle = query.trim().toLowerCase();
  const rows = entries.filter(
    (e) => (!prefix || e.key.startsWith(prefix)) && (!needle || e.key.toLowerCase().includes(needle)),
  );
  const current = entries.find((e) => e.key === selected) ?? null;
  const filtered = Boolean(prefix || needle);

  function select(key: string) {
    setSelected(key);
    setArmed(false);
  }

  /** Up and down move between keys, Home and End jump to the ends. */
  function onListKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const to =
      event.key === "ArrowDown"
        ? index + 1
        : event.key === "ArrowUp"
          ? index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? rows.length - 1
              : -1;
    if (to < 0 || to >= rows.length || to === index) return;
    event.preventDefault();
    const next = rows[to];
    if (!next) return;
    select(next.key);
    listRef.current?.querySelectorAll<HTMLButtonElement>("[data-kv-key]")[to]?.focus();
  }

  function remove(confirm: () => void) {
    if (!current) return;
    if (!armed) {
      setArmed(true);
      return;
    }
    const index = entries.indexOf(current);
    const rest = entries.filter((e) => e !== current);
    const visible = rows.filter((e) => e !== current);
    const next = visible[Math.min(rows.indexOf(current), visible.length - 1)] ?? null;
    setEntries(rest);
    setDeleted({ entry: current, index });
    setSelected(next?.key ?? null);
    setArmed(false);
    confirm();
    onDelete?.(current.key);
  }

  function undo() {
    if (!deleted) return;
    const { entry, index } = deleted;
    setEntries((list) => [...list.slice(0, index), entry, ...list.slice(index)]);
    setSelected(entry.key);
    setDeleted(null);
    onDelete?.(entry.key, true);
  }

  const formatted = current ? pretty(current.value) : null;

  return (
    <section
      aria-label={`Keys in ${namespace}`}
      data-density="compact"
      className={cn("@container min-w-0 overflow-hidden rounded-xl bg-surface text-fg shadow-card", className)}
    >
      <header className="flex flex-col gap-3 border-b border-hairline p-3 @lg:px-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="inline-flex min-w-0 items-center gap-2 font-semibold">
            <KeyIcon className="text-fg-muted" />
            <span className="truncate font-mono text-sb-sm" title={namespace}>
              {namespace}
            </span>
          </span>
          <span className="text-sb-sm text-fg-muted tabular-nums">
            {entries.length.toLocaleString("en")} keys · {formatBytes(entries.reduce((n, e) => n + sizeOf(e), 0))}
          </span>
          <div className="relative w-full @2xl:ms-auto @2xl:w-64">
            <label htmlFor={searchId} className="sr-only">
              Search keys
            </label>
            <SearchIcon className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-fg-muted" />
            <Input
              id={searchId}
              type="search"
              mono
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search keys"
              className="ps-9"
            />
          </div>
        </div>
        {chips.length ? (
          <div role="group" aria-label="Filter by prefix" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5">
            <Chip active={prefix === null} onClick={() => setPrefix(null)}>
              all
            </Chip>
            {chips.map((p) => (
              <Chip key={p} active={prefix === p} onClick={() => setPrefix(prefix === p ? null : p)}>
                {p}
              </Chip>
            ))}
          </div>
        ) : null}
      </header>

      <div className="grid min-w-0 @4xl:grid-cols-[minmax(0,1fr)_32rem]">
        <div className="flex min-w-0 flex-col">
          <Table
            label={`Keys in ${namespace}`}
            containerClassName="rounded-none shadow-none"
            maxHeight="34rem"
            stickyHeader
          >
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="bg-surface">Key</TableHead>
                <TableHead hideBelow="sm" className="w-24 bg-surface text-end">
                  Size
                </TableHead>
                <TableHead className="w-24 bg-surface text-end">Expires</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody ref={listRef}>
              {rows.length === 0 ? (
                <TableEmpty colSpan={3}>
                  <p className="m-0 text-sb-sm text-fg-muted">
                    {filtered ? "No keys match this filter." : "This namespace is empty."}
                  </p>
                </TableEmpty>
              ) : (
                rows.map((entry, index) => (
                  <TableRow
                    key={entry.key}
                    selected={entry.key === selected}
                    className="cursor-pointer"
                    onClick={() => select(entry.key)}
                  >
                    <TableCell className="max-w-0 py-1.5">
                      <button
                        type="button"
                        data-kv-key
                        aria-current={entry.key === selected ? "true" : undefined}
                        tabIndex={
                          entry.key === selected || (!rows.some((r) => r.key === selected) && index === 0) ? 0 : -1
                        }
                        onClick={() => select(entry.key)}
                        onKeyDown={(event) => onListKey(event, index)}
                        title={entry.key}
                        className={cn(
                          "block max-w-full truncate rounded-sm text-start font-mono text-sb-sm",
                          entry.key === selected && "font-semibold",
                          focusRing,
                        )}
                      >
                        {entry.key}
                      </button>
                    </TableCell>
                    <TableCell
                      hideBelow="sm"
                      className="py-1.5 text-end text-sb-sm whitespace-nowrap text-fg-muted tabular-nums"
                    >
                      {formatBytes(sizeOf(entry))}
                    </TableCell>
                    <TableCell className="py-1.5 text-end text-sb-sm whitespace-nowrap tabular-nums">
                      {entry.expiresIn === undefined ? (
                        <span className="text-fg-muted">never</span>
                      ) : (
                        `in ${span(entry.expiresIn)}`
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <footer className="mt-auto flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-hairline px-4 py-2 text-sb-sm text-fg-muted">
            <span className="tabular-nums">
              {filtered ? `${rows.length} of ${entries.length} keys` : `${entries.length} keys, in name order`}
            </span>
            {deleted ? (
              <span className="inline-flex min-w-0 items-center gap-2">
                <span className="truncate">
                  Deleted <span className="font-mono text-fg">{deleted.entry.key}</span>
                </span>
                <Button size="sm" variant="ghost" onClick={undo}>
                  <UndoIcon />
                  Undo
                </Button>
              </span>
            ) : null}
          </footer>
        </div>

        <div
          role="region"
          aria-label={current ? `Key ${current.key}` : "Key details"}
          className="flex min-w-0 flex-col gap-4 border-hairline p-4 @max-4xl:border-t @4xl:border-s"
        >
          {current ? (
            <>
              <CopyId
                value={current.key}
                display={current.key}
                label="Copy key name"
                className="min-w-0 font-semibold"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sb-sm text-fg-muted">Value</span>
                {formatted ? (
                  <SegmentedControl
                    aria-label="Show the value as"
                    size="sm"
                    value={view}
                    onValueChange={setView}
                    options={[
                      { value: "json", label: "JSON" },
                      { value: "text", label: "Raw" },
                    ]}
                  />
                ) : null}
              </div>
              <CodeBlock
                label={`Value of ${current.key}`}
                code={formatted && view === "json" ? formatted : current.value}
                wrap
              />
              <DescriptionList
                items={[
                  { id: "size", term: "Size", details: formatBytes(sizeOf(current)) },
                  {
                    id: "expires",
                    term: "Expires",
                    details: current.expiresIn === undefined ? "Never" : `In ${span(current.expiresIn)}`,
                  },
                  { id: "updated", term: "Updated", details: `${span(current.updatedAgo)} ago` },
                  {
                    id: "metadata",
                    term: "Metadata",
                    mono: Boolean(current.metadata),
                    details: current.metadata ? json(current.metadata) : <span className="text-fg-muted">None</span>,
                  },
                ]}
              />
              <div className="mt-auto flex flex-wrap items-center justify-end gap-2 pt-1">
                {armed ? (
                  <Button size="sm" variant="ghost" onClick={() => setArmed(false)}>
                    Cancel
                  </Button>
                ) : null}
                <InlineConfirm message="Deleted" announce="Key deleted">
                  {({ confirm }) => (
                    <Button
                      size="sm"
                      variant={armed ? "danger" : "ghost"}
                      className={cn(!armed && "text-danger-fg hover:text-danger-fg")}
                      onClick={() => remove(confirm)}
                      onBlur={() => setArmed(false)}
                    >
                      <TrashIcon />
                      {armed ? "Click again to delete" : "Delete key"}
                    </Button>
                  )}
                </InlineConfirm>
              </div>
            </>
          ) : (
            <div className="flex min-h-40 flex-1 items-center justify-center text-center text-sb-sm text-fg-muted">
              Pick a key to see its value, metadata and expiry.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
