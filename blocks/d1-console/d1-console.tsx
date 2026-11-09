/**
 * A SQL console for a D1 database: the tables and their columns, an editor that runs with ⌘↵,
 * and the result grid with its row count and timing. The sample runs simple SELECTs against
 * in-memory tables; pass `run` to send queries to your own database.
 */
import { useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Badge } from "../../src/components/badge";
import { Banner } from "../../src/components/banner";
import { Button } from "../../src/components/button";
import { Kbd } from "../../src/components/kbd";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../src/components/table";
import { Textarea } from "../../src/components/textarea";
import { cn, focusRing } from "../../src/lib/cn";
import { ChevronRightIcon, DatabaseIcon, PlayIcon, TableIcon } from "../../src/lib/icons";

export type SqlValue = string | number | null;
export type ColumnType = "INTEGER" | "REAL" | "TEXT";

export interface SqlColumn {
  name: string;
  type: ColumnType;
  primaryKey?: boolean;
}

export interface SqlTable {
  name: string;
  columns: SqlColumn[];
  rows: SqlValue[][];
}

export interface QueryResult {
  columns: SqlColumn[];
  rows: SqlValue[][];
  /** Rows the database scanned to answer. */
  rowsRead: number;
  durationMs: number;
}

export interface D1ConsoleProps {
  /** The database name shown in the header. */
  database?: string;
  /** The schema for the tables tree, and the data the built-in runner queries. */
  tables?: SqlTable[];
  /** The SQL in the editor at first; it runs once on mount. */
  initialQuery?: string;
  /** Runs a statement. Defaults to `runSelect` over `tables`. Throw an Error to show it as a failed query. */
  run?: (sql: string) => QueryResult | Promise<QueryResult>;
  className?: string;
}

/* ---------------------------------------------------------------------------
 * Sample data: a small plant shop's database
 * ------------------------------------------------------------------------- */

const PLANTS: [string, string, number, number][] = [
  ["Monstera deliciosa", "Araceae", 34.9, 18],
  ["Pilea peperomioides", "Urticaceae", 14.5, 0],
  ["Ficus lyrata", "Moraceae", 48, 7],
  ["Calathea orbifolia", "Marantaceae", 26.5, 11],
  ["Sansevieria trifasciata", "Asparagaceae", 19.9, 32],
  ["Epipremnum aureum", "Araceae", 12, 45],
  ["Zamioculcas zamiifolia", "Araceae", 29.9, 14],
  ["Strelitzia nicolai", "Strelitziaceae", 64, 4],
  ["Alocasia zebrina", "Araceae", 39.5, 6],
  ["Hoya carnosa", "Apocynaceae", 16.9, 21],
  ["Peperomia obtusifolia", "Piperaceae", 11.5, 27],
  ["Philodendron hederaceum", "Araceae", 13.9, 38],
];

const CUSTOMERS: [string, string, string][] = [
  ["Mara Okafor", "mara@example.com", "PT"],
  ["Theo Lindqvist", "theo@example.com", "SE"],
  ["Inês Carvalho", "ines@example.com", "PT"],
  ["Jonas Weber", "jonas@example.com", "DE"],
  ["Aiko Tanaka", "aiko@example.com", "JP"],
  ["Lucía Ortega", "lucia@example.com", "ES"],
  ["Samir Haddad", "samir@example.com", "FR"],
  ["Nora Kelly", "nora@example.com", "IE"],
];

const STATUSES = ["delivered", "delivered", "shipped", "delivered", "paid", "refunded", "delivered", "shipped"];

/** Days after 2026-10-01 as an ISO date, so the sample never depends on today's clock. */
const day = (n: number): string => new Date(Date.UTC(2026, 9, 1 + n)).toISOString().slice(0, 10);

export const sampleTables: SqlTable[] = [
  {
    name: "plants",
    columns: [
      { name: "id", type: "INTEGER", primaryKey: true },
      { name: "name", type: "TEXT" },
      { name: "family", type: "TEXT" },
      { name: "price", type: "REAL" },
      { name: "stock", type: "INTEGER" },
    ],
    rows: PLANTS.map(([name, family, price, stock], i) => [i + 1, name, family, price, stock]),
  },
  {
    name: "customers",
    columns: [
      { name: "id", type: "INTEGER", primaryKey: true },
      { name: "name", type: "TEXT" },
      { name: "email", type: "TEXT" },
      { name: "country", type: "TEXT" },
      { name: "joined", type: "TEXT" },
    ],
    rows: CUSTOMERS.map(([name, email, country], i) => [i + 1, name, email, country, day(i * 3 - 40)]),
  },
  {
    name: "orders",
    columns: [
      { name: "id", type: "INTEGER", primaryKey: true },
      { name: "customer_id", type: "INTEGER" },
      { name: "plant_id", type: "INTEGER" },
      { name: "qty", type: "INTEGER" },
      { name: "total", type: "REAL" },
      { name: "status", type: "TEXT" },
      { name: "placed", type: "TEXT" },
    ],
    rows: Array.from({ length: 24 }, (_, i) => {
      const plant = (i * 5) % PLANTS.length;
      const qty = 1 + ((i * 7) % 3);
      const price = PLANTS[plant]?.[2] ?? 0;
      return [
        1001 + i,
        1 + ((i * 3) % CUSTOMERS.length),
        plant + 1,
        qty,
        Math.round(price * qty * 100) / 100,
        STATUSES[i % STATUSES.length] ?? "paid",
        day(i + 6),
      ];
    }),
  },
  {
    name: "reviews",
    columns: [
      { name: "id", type: "INTEGER", primaryKey: true },
      { name: "plant_id", type: "INTEGER" },
      { name: "rating", type: "INTEGER" },
      { name: "body", type: "TEXT" },
    ],
    rows: [
      [1, 1, 5, "Arrived huge and healthy, two new leaves already."],
      [2, 3, 4, "Dropped a leaf after the move, settled in since."],
      [3, 6, 5, "Impossible to kill. Bought a second one."],
      [4, 2, 3, null],
      [5, 8, 5, "Packed like a museum piece."],
    ],
  },
];

const SAMPLE_QUERY = `-- Best-stocked plants first
SELECT id, name, price, stock FROM plants ORDER BY stock DESC LIMIT 8;`;

/* ---------------------------------------------------------------------------
 * The built-in runner: one SELECT shape, enough for a demo or a read-only browser
 * ------------------------------------------------------------------------- */

const SELECT_RE =
  /^SELECT\s+(.+?)\s+FROM\s+([A-Za-z_]\w*)(?:\s+WHERE\s+([A-Za-z_]\w*)\s*=\s*('(?:[^']|'')*'|-?\d+(?:\.\d+)?|NULL))?(?:\s+ORDER\s+BY\s+([A-Za-z_]\w*)(?:\s+(ASC|DESC))?)?(?:\s+LIMIT\s+(\d+))?$/i;

const SHAPE = "SELECT columns FROM table [WHERE column = value] [ORDER BY column [DESC]] [LIMIT n]";

function literal(raw: string): SqlValue {
  if (/^NULL$/i.test(raw)) return null;
  if (raw.startsWith("'")) return raw.slice(1, -1).replaceAll("''", "'");
  return Number(raw);
}

/**
 * Runs `SELECT cols|* FROM t [WHERE col = value] [ORDER BY col [ASC|DESC]] [LIMIT n]` over
 * in-memory tables. Anything else throws an Error that says what it accepts.
 */
export function runSelect(sql: string, tables: SqlTable[]): QueryResult {
  const started = performance.now();
  const text = sql
    .replace(/--[^\n]*/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/;$/, "")
    .trim();
  if (!text) throw new Error("There is no statement to run.");
  if (text.includes(";")) throw new Error("Run one statement at a time.");
  const m = SELECT_RE.exec(text);
  if (!m) {
    const verb = text.split(" ")[0]?.toUpperCase() ?? "";
    throw new Error(
      verb === "SELECT"
        ? `This console understands ${SHAPE}.`
        : `${verb} is not supported here: this console runs read-only queries of the form ${SHAPE}.`,
    );
  }
  const [, cols = "*", tableName = "", whereCol, whereVal, orderCol, orderDir, limit] = m;
  const table = tables.find((t) => t.name.toLowerCase() === tableName.toLowerCase());
  if (!table) throw new Error(`no such table: ${tableName}`);
  const index = (name: string): number => {
    const i = table.columns.findIndex((c) => c.name.toLowerCase() === name.toLowerCase());
    if (i < 0) throw new Error(`no such column: ${name}`);
    return i;
  };
  const picked = cols.trim() === "*" ? table.columns.map((_, i) => i) : cols.split(",").map((c) => index(c.trim()));
  let rows = table.rows;
  if (whereCol && whereVal !== undefined) {
    const i = index(whereCol);
    const want = literal(whereVal);
    rows = rows.filter((r) => (want === null ? r[i] === null : r[i] === want));
  }
  if (orderCol) {
    const i = index(orderCol);
    const dir = orderDir?.toUpperCase() === "DESC" ? -1 : 1;
    rows = [...rows].sort((a, b) => {
      const x = a[i] ?? null;
      const y = b[i] ?? null;
      if (x === y) return 0;
      if (x === null) return -dir;
      if (y === null) return dir;
      return (x < y ? -1 : 1) * dir;
    });
  }
  if (limit !== undefined) rows = rows.slice(0, Number(limit));
  return {
    columns: picked.map((i) => table.columns[i] as SqlColumn),
    rows: rows.map((r) => picked.map((i) => r[i] ?? null)),
    rowsRead: table.rows.length,
    durationMs: Math.max(0.1, performance.now() - started),
  };
}

/* ---------------------------------------------------------------------------
 * The console
 * ------------------------------------------------------------------------- */

type Outcome = { kind: "ok"; result: QueryResult } | { kind: "error"; message: string };

function attempt(run: (sql: string) => QueryResult, sql: string): Outcome {
  try {
    return { kind: "ok", result: run(sql) };
  } catch (error) {
    return { kind: "error", message: error instanceof Error ? error.message : "The query did not run." };
  }
}

const isMac = (): boolean => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/** Tables with their columns. Up and down move between the rows of the tree; right opens, left closes. */
function TablesTree({
  tables,
  current,
  onQuery,
}: {
  tables: SqlTable[];
  current: string | null;
  onQuery: (table: string) => void;
}) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(tables.slice(0, 1).map((t) => t.name)));
  const ref = useRef<HTMLUListElement>(null);
  const toggle = (name: string, to?: boolean) =>
    setOpen((was) => {
      const next = new Set(was);
      if (to ?? !next.has(name)) next.add(name);
      else next.delete(name);
      return next;
    });

  function onKey(event: KeyboardEvent<HTMLButtonElement>, name: string) {
    const items = [...(ref.current?.querySelectorAll<HTMLButtonElement>("[data-tree-item]") ?? [])];
    const at = items.indexOf(event.currentTarget);
    const move = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: items.length - 1 }[event.key];
    if (move !== undefined) {
      event.preventDefault();
      items[Math.max(0, Math.min(items.length - 1, move))]?.focus();
    } else if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      toggle(name, event.key === "ArrowRight");
    }
  }

  return (
    <ul ref={ref} className="flex flex-col gap-0.5 p-1.5" aria-label="Tables">
      {tables.map((t) => {
        const expanded = open.has(t.name);
        return (
          <li key={t.name} className="m-0 max-w-none [font-size:inherit] [line-height:inherit] text-[color:inherit]">
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                tabIndex={-1}
                aria-expanded={expanded}
                aria-label={`${expanded ? "Hide" : "Show"} columns of ${t.name}`}
                onClick={() => toggle(t.name)}
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-md text-fg-muted hover:bg-hover hover:text-fg pointer-coarse:size-11",
                  focusRing,
                )}
              >
                <ChevronRightIcon
                  className={cn(
                    "size-3.5 transition-transform duration-(--sb-duration-hover) ease-hover",
                    expanded && "rotate-90",
                  )}
                />
              </button>
              <button
                type="button"
                data-tree-item
                aria-current={current === t.name ? "true" : undefined}
                title={`SELECT * FROM ${t.name}`}
                onClick={() => onQuery(t.name)}
                onKeyDown={(event) => onKey(event, t.name)}
                className={cn(
                  "flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-start hover:bg-hover",
                  "aria-[current=true]:bg-hover",
                  focusRing,
                )}
              >
                <TableIcon className="text-fg-muted" />
                <span
                  title={t.name}
                  className={cn("min-w-0 flex-1 truncate font-mono text-sb-sm", current === t.name && "font-semibold")}
                >
                  {t.name}
                </span>
                <span className="shrink-0 text-sb-xs text-fg-muted tabular-nums">
                  {t.rows.length.toLocaleString("en")}
                </span>
              </button>
            </div>
            {expanded ? (
              <ul className="flex flex-col gap-1 pt-1 pb-2 ps-11 pe-2" aria-label={`Columns of ${t.name}`}>
                {t.columns.map((c) => (
                  <li key={c.name} className="flex min-w-0 items-baseline justify-between gap-2 font-mono text-sb-xs">
                    <span className="truncate" title={c.name}>
                      {c.name}
                    </span>
                    <span className="shrink-0 text-fg-muted">
                      {c.type}
                      {c.primaryKey ? " · PK" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function ResultGrid({ outcome, busy }: { outcome: Outcome | null; busy: boolean }) {
  if (!outcome) {
    return (
      <p className="m-0 border-t border-hairline px-4 py-8 text-center text-sb-sm text-fg-muted">
        Run a query to see its rows here.
      </p>
    );
  }
  if (outcome.kind === "error") {
    return (
      <div className="border-t border-hairline p-3 @lg:p-4" role="alert">
        <Banner tone="danger" title="The query failed">
          <span className="font-mono text-sb-sm break-words">{outcome.message}</span>
        </Banner>
      </div>
    );
  }
  const { result } = outcome;
  const numeric = result.columns.map((c) => c.type !== "TEXT");
  const count = result.rows.length;
  return (
    <div className={cn("flex min-w-0 flex-col border-t border-hairline transition-opacity", busy && "opacity-60")}>
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sb-sm text-fg-muted @lg:px-4"
        role="status"
      >
        <Badge tone="success" dot>
          {count.toLocaleString("en")} {count === 1 ? "row" : "rows"}
        </Badge>
        <span className="tabular-nums">
          {result.durationMs < 10 ? result.durationMs.toFixed(1) : Math.round(result.durationMs)} ms ·{" "}
          {result.rowsRead.toLocaleString("en")} rows read
        </span>
      </div>
      {count ? (
        <Table label="Query result" containerClassName="rounded-none shadow-none" maxHeight="24rem" stickyHeader>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 bg-surface text-end">#</TableHead>
              {result.columns.map((c, i) => (
                <TableHead key={c.name} className={cn("bg-surface whitespace-nowrap", numeric[i] && "text-end")}>
                  <span className="font-mono">{c.name}</span>{" "}
                  <span className="text-sb-xs font-normal text-fg-muted">{c.type}</span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.map((row, r) => (
              <TableRow key={r}>
                <TableCell className="py-1.5 text-end font-mono text-sb-xs text-fg-muted tabular-nums">
                  {r + 1}
                </TableCell>
                {row.map((value, c) => (
                  <TableCell
                    key={c}
                    title={value === null ? "NULL" : String(value)}
                    className={cn(
                      "max-w-72 truncate py-1.5 font-mono text-sb-sm whitespace-nowrap",
                      numeric[c] && "text-end tabular-nums",
                    )}
                  >
                    {value === null ? (
                      <span className="text-fg-muted">NULL</span>
                    ) : typeof value === "number" && result.columns[c]?.type === "REAL" ? (
                      value.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    ) : (
                      String(value)
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="m-0 px-4 pb-4 text-sb-sm text-fg-muted">The query ran and matched no rows.</p>
      )}
    </div>
  );
}

export function D1Console({
  database = "fernleaf-shop",
  tables = sampleTables,
  initialQuery = SAMPLE_QUERY,
  run,
  className,
}: D1ConsoleProps) {
  const exec = run ?? ((sql: string) => runSelect(sql, tables));
  const [sql, setSql] = useState(initialQuery);
  const [busy, setBusy] = useState(false);
  const [showTables, setShowTables] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  // The first query runs on mount (synchronously for the built-in runner), so the grid is never empty.
  const [outcome, setOutcome] = useState<Outcome | null>(() =>
    run ? null : attempt((s) => runSelect(s, tables), initialQuery),
  );
  const editorId = useId();

  async function execute(text = sql) {
    setBusy(true);
    try {
      setOutcome({ kind: "ok", result: await exec(text) });
    } catch (error) {
      setOutcome({ kind: "error", message: error instanceof Error ? error.message : "The query did not run." });
    } finally {
      setBusy(false);
    }
  }

  function queryTable(name: string) {
    const text = `SELECT * FROM ${name} LIMIT 50;`;
    setSql(text);
    setCurrent(name);
    void execute(text);
  }

  return (
    <section
      aria-label={`SQL console for ${database}`}
      data-density="compact"
      className={cn("@container min-w-0 overflow-hidden rounded-xl bg-surface text-fg shadow-card", className)}
    >
      <div className="grid min-w-0 @3xl:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="min-w-0 border-hairline @max-3xl:border-b @3xl:border-e" aria-label="Schema">
          <div className="flex items-center gap-2 px-3 pt-3 pb-1">
            <DatabaseIcon className="text-fg-muted" />
            <span className="min-w-0 flex-1 truncate font-mono text-sb-sm font-semibold" title={database}>
              {database}
            </span>
            <button
              type="button"
              aria-expanded={showTables}
              onClick={() => setShowTables((v) => !v)}
              className={cn(
                "inline-flex h-7 items-center gap-1 rounded-md px-2 text-sb-sm text-fg-muted hover:bg-hover hover:text-fg pointer-coarse:h-11 @3xl:hidden",
                focusRing,
              )}
            >
              {tables.length} tables
              <ChevronRightIcon
                className={cn(
                  "size-3.5 transition-transform duration-(--sb-duration-hover) ease-hover",
                  showTables && "rotate-90",
                )}
              />
            </button>
          </div>
          <div className={cn(!showTables && "@max-3xl:hidden")}>
            <p className="m-0 px-3 pt-2 text-sb-xs text-fg-muted @max-3xl:hidden">Tables · click one to query it</p>
            <TablesTree tables={tables} current={current} onQuery={queryTable} />
          </div>
        </aside>

        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-3 border-b border-hairline px-3 py-2">
            <label htmlFor={editorId} className="text-sb-sm font-semibold">
              Query
            </label>
            <span className="text-sb-xs text-fg-muted @max-md:hidden">Read-only · one statement</span>
            <Button
              variant="primary"
              size="sm"
              className="ms-auto"
              loading={busy}
              onClick={() => void execute()}
              aria-keyshortcuts="Meta+Enter Control+Enter"
            >
              <PlayIcon />
              Run
              <Kbd className="@max-md:hidden">{isMac() ? "⌘↵" : "Ctrl ↵"}</Kbd>
            </Button>
          </div>
          <Textarea
            id={editorId}
            mono
            spellCheck={false}
            wrap="off"
            rows={5}
            value={sql}
            placeholder="SELECT * FROM plants LIMIT 50;"
            onChange={(event) => setSql(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void execute();
              }
            }}
            className="min-h-32 resize-y rounded-none bg-well shadow-none hover:shadow-none focus-visible:bg-well focus-visible:outline-offset-[-2px]"
          />
          <ResultGrid outcome={outcome} busy={busy} />
        </div>
      </div>
    </section>
  );
}
