/**
 * A live log tail with level and source filter chips, search, and a Live or Paused stream that
 * holds still while the pointer rests on it. Lines are mono, newest first, with UTC timestamps.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../src/components/button";
import { Input } from "../../src/components/input";
import { SegmentedControl } from "../../src/components/segmented-control";
import { StatusDot } from "../../src/components/status-dot";
import { StatusGlyph } from "../../src/components/status-glyph";
import type { Status } from "../../src/components/status";
import { cn, focusRing, pressMotion } from "../../src/lib/cn";
import { SearchIcon } from "../../src/lib/icons";

export type LogLevel = "info" | "warn" | "error";

export interface LogLine {
  id: string;
  /** Milliseconds since the epoch. */
  t: number;
  level: LogLevel;
  /** Where the line came from: "http", "console", "queue", "cron". */
  source: string;
  message: string;
  /** For request lines. */
  method?: string;
  path?: string;
  status?: number;
  durationMs?: number;
}

export interface LogsPanelProps {
  /** Initial lines, newest first. */
  lines?: LogLine[];
  /**
   * Called on an interval while live to produce the next line. Defaults to a deterministic sample
   * generator; pass `null` to stream nothing (wire your own source through `lines`).
   */
  next?: ((index: number, last: LogLine | undefined) => LogLine) | null;
  /** Milliseconds between generated lines. Default 1400. */
  interval?: number;
  /** Lines kept in memory. Default 300. */
  max?: number;
  title?: string;
  className?: string;
}

/* ---------------------------------------------------------------------------
 * Sample data: a small API on a weekday afternoon. Seeded, so every render matches.
 * ------------------------------------------------------------------------- */

const START = Date.UTC(2026, 10, 6, 14, 58, 0);

function seeded(n: number): number {
  let x = (n + 0x6d2b79f5) | 0;
  x = Math.imul(x ^ (x >>> 15), x | 1);
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
}

const ROUTES = [
  { method: "GET", path: "/api/notes", ms: 18 },
  { method: "GET", path: "/api/notes/8f3a", ms: 11 },
  { method: "POST", path: "/api/notes", ms: 42 },
  { method: "GET", path: "/healthz", ms: 2 },
  { method: "PUT", path: "/api/notes/2c91", ms: 37 },
  { method: "GET", path: "/api/search?q=raft", ms: 64 },
  { method: "DELETE", path: "/api/notes/77d0", ms: 29 },
];

const CONSOLE = [
  { level: "info", message: "cache warm: 412 keys in 38 ms" },
  { level: "warn", message: "slow query on notes_by_tag (812 ms)" },
  { level: "info", message: "session refreshed for user_19c" },
  { level: "error", message: "TypeError: Cannot read properties of undefined (reading 'title')" },
] as const;

/** One sample line. Mostly requests, some console output, the odd queue or cron run. */
export function sampleLine(index: number, last?: LogLine): LogLine {
  const r = seeded(index);
  const t = (last?.t ?? START) + 300 + Math.round(seeded(index + 7919) * 2200);
  const id = `l${index}`;
  if (r < 0.6) {
    const route = ROUTES[Math.floor(seeded(index + 31) * ROUTES.length)] ?? ROUTES[0]!;
    const roll = seeded(index + 97);
    const status =
      route.path === "/healthz" ? 200 : roll > 0.95 ? 500 : roll > 0.85 ? 404 : route.method === "POST" ? 201 : 200;
    return {
      id,
      t,
      level: status >= 500 ? "error" : status >= 400 ? "warn" : "info",
      source: "http",
      method: route.method,
      path: route.path,
      status,
      durationMs: Math.round(route.ms * (0.6 + seeded(index + 13) * 1.2)),
      message: status >= 500 ? "upstream timed out" : "",
    };
  }
  if (r < 0.85) {
    const line = CONSOLE[Math.floor(seeded(index + 53) * CONSOLE.length)] ?? CONSOLE[0];
    return { id, t, level: line.level, source: "console", message: line.message };
  }
  if (r < 0.94) {
    const n = 1 + Math.floor(seeded(index + 3) * 24);
    return { id, t, level: "info", source: "queue", message: `emails: delivered batch of ${n}` };
  }
  return { id, t, level: "info", source: "cron", message: "*/5 * * * * digest: 3 notes summarised" };
}

/** Sample data: the last 40 lines, newest first. */
export const sampleLines: LogLine[] = (() => {
  const out: LogLine[] = [];
  for (let i = 0; i < 40; i++) out.push(sampleLine(i, out[out.length - 1]));
  return out.reverse();
})();

/* ---------------------------------------------------------------------------
 * Pieces
 * ------------------------------------------------------------------------- */

const LEVELS: { value: LogLevel | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "info", label: "Info" },
  { value: "warn", label: "Warn" },
  { value: "error", label: "Error" },
];

const levelStatus: Record<LogLevel, Status> = { info: "neutral", warn: "warning", error: "danger" };
const levelText: Record<LogLevel, string> = { info: "text-fg-muted", warn: "text-warn-fg", error: "text-danger-fg" };

/** 14:58:21.402, always UTC. */
const clock = (t: number) => new Date(t).toISOString().slice(11, 23);

/** A toggle chip: quiet outline when off, a soft filled pill when on. */
function Chip({
  pressed,
  onClick,
  children,
  count,
}: {
  pressed: boolean;
  onClick: () => void;
  children: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm pointer-coarse:h-11",
        pressed
          ? "bg-neutral-soft font-semibold text-fg"
          : "text-fg-muted shadow-[inset_0_0_0_1px_var(--sb-hairline-strong)] hover:bg-hover hover:text-fg",
        pressMotion,
        focusRing,
      )}
    >
      {children}
      {count !== undefined ? <span className="font-normal text-fg-muted tabular-nums">{count}</span> : null}
    </button>
  );
}

const ROW = "@3xl:grid @3xl:grid-cols-[7.5rem_4.25rem_4.5rem_minmax(0,1fr)_4rem] @3xl:gap-x-3";

function Line({ line }: { line: LogLine }) {
  const request = line.source === "http";
  const statusTone =
    (line.status ?? 0) >= 500
      ? "font-semibold text-danger-fg"
      : (line.status ?? 0) >= 400
        ? "text-warn-fg"
        : "text-fg-muted";
  const body = (
    <>
      {request ? (
        <>
          <span className="text-fg-muted">{line.method} </span>
          <span className="text-fg">{line.path}</span>
          <span className={cn("ps-2 tabular-nums", statusTone)}>{line.status}</span>
        </>
      ) : null}
      {line.message ? (
        <span className={cn(request && "ps-2", line.level === "error" ? "text-danger-fg" : "text-fg")}>
          {line.message}
        </span>
      ) : null}
    </>
  );
  return (
    <li className={cn("px-4 py-1.5", ROW, line.level === "error" ? "bg-danger-soft/45" : "hover:bg-hover/50")}>
      <div className="flex flex-wrap items-center gap-x-3 @3xl:contents">
        <time className="text-fg-muted tabular-nums" dateTime={new Date(line.t).toISOString()}>
          {clock(line.t)}
        </time>
        <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold uppercase", levelText[line.level])}>
          <StatusGlyph status={levelStatus[line.level]} />
          {line.level}
        </span>
        <span className="text-fg-muted">{line.source}</span>
        <span
          className="hidden min-w-0 truncate @3xl:block"
          title={[line.path, line.message].filter(Boolean).join(" ")}
        >
          {body}
        </span>
        <span className="text-fg-muted tabular-nums @3xl:text-end">
          {line.durationMs !== undefined ? `${line.durationMs} ms` : ""}
        </span>
      </div>
      <p className="mt-0.5 break-words @3xl:hidden">{body}</p>
    </li>
  );
}

/* ---------------------------------------------------------------------------
 * The panel
 * ------------------------------------------------------------------------- */

/**
 * A live log tail with level and source filter chips, search, and a Live or Paused stream that
 * holds still while the pointer rests on it.
 */
export function LogsPanel({
  lines: initial = sampleLines,
  next = sampleLine,
  interval = 1400,
  max = 300,
  title = "Logs",
  className,
}: LogsPanelProps) {
  const [lines, setLines] = useState(initial);
  const [mode, setMode] = useState<"live" | "paused">("live");
  const [hovering, setHovering] = useState(false);
  const [waiting, setWaiting] = useState<LogLine[]>([]);
  const [level, setLevel] = useState<LogLevel | "all">("all");
  const [sources, setSources] = useState<ReadonlySet<string>>(new Set());
  const [query, setQuery] = useState("");
  const counter = useRef(initial.length);
  const newest = useRef<LogLine | undefined>(initial[0]);
  const held = mode === "paused" || hovering;

  useEffect(() => setLines(initial), [initial]);

  // The stream keeps producing while held; lines queue and land on resume, so nothing moves under the pointer.
  useEffect(() => {
    if (!next) return;
    const timer = setInterval(() => {
      const line = next(counter.current++, newest.current);
      newest.current = line;
      setWaiting((w) => [line, ...w]);
    }, interval);
    return () => clearInterval(timer);
  }, [next, interval]);

  useEffect(() => {
    if (held || waiting.length === 0) return;
    setLines((current) => [...waiting, ...current].slice(0, max));
    setWaiting([]);
  }, [held, waiting, max]);

  const allSources = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of lines) counts.set(l.source, (counts.get(l.source) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [lines]);

  const needle = query.trim().toLowerCase();
  const shown = lines.filter(
    (l) =>
      (level === "all" || l.level === level) &&
      (sources.size === 0 || sources.has(l.source)) &&
      (!needle || `${l.method ?? ""} ${l.path ?? ""} ${l.status ?? ""} ${l.message}`.toLowerCase().includes(needle)),
  );
  const filtered = level !== "all" || sources.size > 0 || needle !== "";
  const clear = () => {
    setLevel("all");
    setSources(new Set());
    setQuery("");
  };
  const toggleSource = (s: string) =>
    setSources((current) => {
      const nextSet = new Set(current);
      if (nextSet.has(s)) nextSet.delete(s);
      else nextSet.add(s);
      return nextSet;
    });

  const statusLabel = `${
    mode === "paused"
      ? `Paused${waiting.length ? ` · ${waiting.length} new ${waiting.length === 1 ? "line" : "lines"} waiting` : ""}`
      : hovering
        ? "Held while you read"
        : "Live · streaming"
  } · ${shown.length} ${shown.length === 1 ? "line" : "lines"}${filtered ? ` of ${lines.length}` : ""}`;

  return (
    <section
      aria-labelledby="logs-panel-title"
      className={cn("@container flex min-w-0 flex-col rounded-xl bg-surface text-fg shadow-card", className)}
    >
      <div className="flex flex-col gap-3 px-4 pt-4 pb-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="logs-panel-title" className="me-auto text-md font-semibold">
            {title}
          </h2>
          <div className="relative order-last w-full @2xl:order-none @2xl:w-64">
            <SearchIcon className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-fg-muted" />
            <Input
              type="search"
              aria-label="Search logs"
              placeholder="Path, status or message"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="ps-9"
            />
          </div>
          <SegmentedControl
            aria-label="Stream"
            size="sm"
            className="w-auto"
            value={mode}
            options={[
              { value: "live", label: "Live" },
              { value: "paused", label: "Paused" },
            ]}
            onValueChange={setMode}
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div role="group" aria-label="Level" className="flex flex-wrap items-center gap-1.5">
            {LEVELS.map((l) => (
              <Chip key={l.value} pressed={level === l.value} onClick={() => setLevel(l.value)}>
                {l.label}
              </Chip>
            ))}
          </div>
          <span aria-hidden="true" className="hidden h-5 w-px bg-hairline @md:block" />
          <div role="group" aria-label="Source" className="flex flex-wrap items-center gap-1.5">
            {allSources.map(([s, n]) => (
              <Chip key={s} pressed={sources.has(s)} onClick={() => toggleSource(s)} count={n}>
                {s}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <div
        className="h-[26rem] overflow-y-auto border-t border-hairline font-mono text-[13px] leading-5"
        onPointerEnter={(event) => event.pointerType === "mouse" && setHovering(true)}
        onPointerLeave={() => setHovering(false)}
      >
        <div
          aria-hidden="true"
          className={cn(
            "sticky top-0 z-[1] hidden bg-surface px-4 py-2 font-sans text-xs font-semibold text-fg-muted shadow-[inset_0_-1px_0_var(--sb-hairline)] @3xl:grid",
            ROW,
          )}
        >
          <span>Time (UTC)</span>
          <span>Level</span>
          <span>Source</span>
          <span>Message</span>
          <span className="text-end">Duration</span>
        </div>
        {shown.length === 0 ? (
          <div className="flex h-[calc(100%-2.25rem)] flex-col items-center justify-center gap-2 px-6 text-center font-sans text-base text-fg-muted">
            <p>{filtered ? "No lines match these filters yet." : "Waiting for the first line."}</p>
            {filtered ? (
              <Button size="sm" variant="ghost" onClick={clear}>
                Clear filters
              </Button>
            ) : null}
          </div>
        ) : (
          <ol aria-label="Log lines, newest first" className="divide-y divide-hairline/60">
            {shown.map((line) => (
              <Line key={line.id} line={line} />
            ))}
          </ol>
        )}
      </div>

      <p className="flex min-h-11 items-center border-t border-hairline px-4 py-2.5 text-sm text-fg-muted">
        <StatusDot status={held ? "neutral" : "success"} live={!held} label={statusLabel} />
      </p>
    </section>
  );
}
