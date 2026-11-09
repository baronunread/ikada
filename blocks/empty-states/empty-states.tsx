/**
 * The four things an empty view can mean, each with one way forward: nothing created yet, nothing
 * matching a filter, nothing deployed, and a load that failed with a retry.
 */
import { useState } from "react";
import { Button } from "../../src/components/button";
import { CodeBlock } from "../../src/components/code-block";
import { EmptyState } from "../../src/components/empty-state";
import { Input } from "../../src/components/input";
import { cn } from "../../src/lib/cn";
import { AlertIcon, FolderIcon, RefreshIcon, RocketIcon, SearchIcon } from "../../src/lib/icons";

/** First run: nothing exists yet. Says what the list will hold and offers the one action that fills it. */
export function NoProjectsYet({ onCreate = () => {} }: { onCreate?: () => void }) {
  return (
    <div className="flex flex-col justify-center rounded-xl bg-surface shadow-card">
      <EmptyState
        icon={<FolderIcon />}
        title="Create your first project"
        description="A project groups the sprouts that ship together, like a site and its API."
        action={
          <Button variant="primary" onClick={onCreate}>
            New project
          </Button>
        }
        className="py-12"
      />
    </div>
  );
}

const SAMPLE_ROWS = ["pond-web", "pond-api", "nightly-digest", "thumbnailer", "lily-pad-web"];

/**
 * A filter that matches nothing: the list stays in place, the empty line names the query and
 * clearing it is one click. Here the search runs over a few sample names; try "reed".
 */
export function NoResults({ rows = SAMPLE_ROWS, initialQuery = "reed" }: { rows?: string[]; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const q = query.trim().toLowerCase();
  const shown = rows.filter((r) => r.includes(q));
  return (
    <div className="flex flex-col overflow-hidden rounded-xl bg-surface shadow-card">
      <div className="relative border-b border-hairline p-3">
        <SearchIcon className="pointer-events-none absolute start-6 top-1/2 -translate-y-1/2 text-fg-muted" />
        <Input
          type="search"
          aria-label="Search sprouts"
          placeholder="Search sprouts"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="ps-9"
        />
      </div>
      {shown.length ? (
        <ul className="divide-y divide-hairline">
          {shown.map((r) => (
            <li key={r} className="px-4 py-2.5 font-mono text-sb-sm">
              {r}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<SearchIcon />}
          title="Nothing matches this search"
          description={
            <>
              No sprout name contains “{query.trim()}”. Check the spelling or clear the search to see all {rows.length}.
            </>
          }
          action={
            <Button variant="secondary" size="sm" onClick={() => setQuery("")}>
              Clear search
            </Button>
          }
        />
      )}
    </div>
  );
}

/** Created but never deployed: the next step is a command, so the empty state hands it over to copy. */
export function NothingDeployed({ command = "npx sproutboat deploy" }: { command?: string }) {
  return (
    <div className="flex flex-col justify-center rounded-xl bg-surface shadow-card">
      <EmptyState
        icon={<RocketIcon />}
        title="Nothing deployed yet"
        description="From the folder with your code, deploy once and this sprout goes live with its own URL."
        action={<CodeBlock label="Deploy command" code={command} className="w-64 max-w-full text-start" />}
        className="py-12"
      />
    </div>
  );
}

/**
 * A load that failed: say what could not load and why in plain words, and offer a retry. The
 * sample retry takes a moment and fails again, so the loading state can be seen.
 */
export function LoadFailed({
  what = "your projects",
  onRetry,
}: {
  what?: string;
  /** Retries the load. Defaults to a sample that waits a second. */
  onRetry?: () => Promise<void> | void;
}) {
  const [retrying, setRetrying] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const retry = async () => {
    setRetrying(true);
    try {
      await (onRetry ? onRetry() : new Promise<void>((r) => setTimeout(r, 1000)));
    } finally {
      setRetrying(false);
      setAttempts((a) => a + 1);
    }
  };
  return (
    <div className="flex flex-col justify-center rounded-xl bg-surface shadow-card" role="alert">
      <EmptyState
        icon={<AlertIcon className="text-danger-fg" />}
        title={`Could not load ${what}`}
        description={
          <>{attempts ? `Still unreachable after ${attempts + 1} tries. ` : ""}Check your connection, then try again.</>
        }
        action={
          <Button variant="secondary" loading={retrying} onClick={() => void retry()}>
            <RefreshIcon />
            Try again
          </Button>
        }
        className="py-12"
      />
    </div>
  );
}

export interface EmptyStatesProps {
  className?: string;
  /** What "New project" does in the first-run state. */
  onCreate?: () => void;
}

// All four as a gallery: keep the one your view needs and delete the rest.
export function EmptyStates({ className, onCreate }: EmptyStatesProps) {
  const items = [
    { id: "first", title: "First run", body: <NoProjectsYet onCreate={onCreate} /> },
    { id: "filter", title: "No results", body: <NoResults /> },
    { id: "deploy", title: "Nothing deployed", body: <NothingDeployed /> },
    { id: "error", title: "Load failed", body: <LoadFailed /> },
  ];
  return (
    <div className={cn("@container", className)}>
      <div className="grid grid-cols-1 gap-5 @2xl:grid-cols-2">
        {items.map((item) => (
          <section key={item.id} aria-labelledby={`empty-${item.id}`} className="flex min-w-0 flex-col gap-2">
            <h2 id={`empty-${item.id}`} className="px-1 text-sb-sm font-semibold text-fg-muted">
              {item.title}
            </h2>
            <div className="flex flex-1 flex-col *:flex-1">{item.body}</div>
          </section>
        ))}
      </div>
    </div>
  );
}
