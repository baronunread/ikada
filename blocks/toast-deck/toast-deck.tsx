/**
 * Toasts in practice: a revoke that removes the row at once and offers Undo (also ⌘Z), a deploy
 * that morphs one toast from Uploaded to Live or to a failure with Retry, and the history feed.
 *
 * The toasts render in ikada's deck, which belongs to the app, not to this block: mount
 * `<ToastProvider>` once near your app root. The store behind `toast` is shared, so a second
 * provider would draw every toast twice; this block only calls `toast` and `deployToast`.
 */
import { useEffect, useRef, useState } from "react";
import { Button } from "../../src/components/button";
import { IconButton } from "../../src/components/icon-button";
import { StatusGlyph } from "../../src/components/status-glyph";
import { deployToast, toast } from "../../src/components/toast";
import type { DeployToast, ToastEvent, ToastTone } from "../../src/components/toast";
import { cn } from "../../src/lib/cn";
import { KeyIcon, RocketIcon, TrashIcon } from "../../src/lib/icons";

export interface ApiToken {
  id: string;
  name: string;
  /** The visible tail of the secret, never the secret itself. */
  hint: string;
  lastUsed: string;
}

export interface ToastDeckProps {
  tokens?: ApiToken[];
  /** The deploy's name in its toast, e.g. "field-notes v48". */
  deployName?: string;
  /** Called when a revoke is final (its Undo window closed without an undo). */
  onRevoke?: (token: ApiToken) => void;
  className?: string;
}

/** Sample data: four API tokens on a small team account. */
export const sampleTokens: ApiToken[] = [
  { id: "tok_1", name: "ci-deploy", hint: "sb_live_…4f2a", lastUsed: "2 min ago" },
  { id: "tok_2", name: "robin-laptop", hint: "sb_live_…91c0", lastUsed: "yesterday" },
  { id: "tok_3", name: "staging-bot", hint: "sb_live_…07de", lastUsed: "3 days ago" },
  { id: "tok_4", name: "grafana-read", hint: "sb_live_…b3e8", lastUsed: "never" },
];

interface Seen {
  key: string;
  tone: ToastTone;
  title: string;
  description?: string;
  at: number;
}

const clock = (t: number) =>
  new Date(t).toLocaleTimeString("en", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });

/** The last few toasts, from `toast.subscribe`: the hook an Activity feed or a bell would use. */
function useToastHistory(limit = 4): Seen[] {
  const [seen, setSeen] = useState<Seen[]>([]);
  useEffect(
    () =>
      toast.subscribe((event: ToastEvent) => {
        if (event.type === "close" || event.toast.silent) return;
        const { id, tone, title, description } = event.toast;
        setSeen((list) => {
          const entry = { key: `${id}:${title}`, tone, title, description, at: event.at };
          return [entry, ...list.filter((s) => s.key !== entry.key)].slice(0, limit);
        });
      }),
    [limit],
  );
  return seen;
}

export function ToastDeck({
  tokens: initial = sampleTokens,
  deployName = "field-notes v48",
  onRevoke,
  className,
}: ToastDeckProps) {
  const [tokens, setTokens] = useState(initial);
  const [deploying, setDeploying] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const history = useToastHistory();

  useEffect(() => setTokens(initial), [initial]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));

  function revoke(token: ApiToken) {
    const index = tokens.findIndex((t) => t.id === token.id);
    setTokens((list) => list.filter((t) => t.id !== token.id));
    let undone = false;
    toast.undo({
      title: `Revoked ${token.name}`,
      description: "Requests with it now get 401.",
      confirmTitle: `Restored ${token.name}`,
      onUndo: () => {
        undone = true;
        setTokens((list) => {
          if (list.some((t) => t.id === token.id)) return list;
          const next = [...list];
          next.splice(Math.min(index, next.length), 0, token);
          return next;
        });
      },
    });
    // The undo toast stays 8s; after that the revoke is final.
    later(8200, () => !undone && onRevoke?.(token));
  }

  /** One toast for the whole deploy; Retry morphs the same toast back to Uploaded. */
  function deploy(fail: boolean) {
    const run: DeployToast = deployToast({ name: deployName, onRetry: () => steps(run, false) });
    steps(run, fail);
  }

  /** Uploaded, the progress line creeping on, then Live or a failure with Retry. */
  function steps(run: DeployToast, fail: boolean) {
    setDeploying(true);
    run.uploaded(0.2);
    later(500, () => run.progress(0.45));
    later(1000, () => run.progress(0.75));
    later(1500, () => {
      if (fail) run.failed("build exited with 1");
      else run.live();
      setDeploying(false);
    });
  }

  return (
    <div className={cn("@container text-fg", className)}>
      <div className="grid gap-4 @3xl:grid-cols-[minmax(0,1fr)_18rem]">
        <section
          aria-labelledby="toast-deck-tokens"
          className="flex min-w-0 flex-col rounded-xl bg-surface shadow-card"
        >
          <header className="flex flex-wrap items-center gap-3 px-4 pt-4 pb-3">
            <div className="me-auto min-w-0">
              <h2 id="toast-deck-tokens" className="text-sb-md font-semibold">
                API tokens
              </h2>
              <p className="text-sb-sm text-fg-muted">Revoke one: it goes at once, and Undo (or ⌘Z) brings it back.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" disabled={deploying} onClick={() => deploy(true)}>
                Deploy a broken build
              </Button>
              <Button variant="primary" size="sm" disabled={deploying} onClick={() => deploy(false)}>
                <RocketIcon />
                Deploy
              </Button>
            </div>
          </header>
          {tokens.length ? (
            <ul className="divide-y divide-hairline border-t border-hairline">
              {tokens.map((token) => (
                <li key={token.id} className="flex min-h-(--sb-row-h) items-center gap-3 px-4 py-2">
                  <span
                    aria-hidden="true"
                    className="grid size-8 shrink-0 place-items-center rounded-lg bg-well text-fg-muted"
                  >
                    <KeyIcon />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col @md:flex-row @md:items-center @md:gap-3">
                    <span className="truncate font-semibold">{token.name}</span>
                    <span className="truncate font-mono text-sb-sm text-fg-muted">{token.hint}</span>
                  </div>
                  <span className="hidden shrink-0 text-sb-sm text-fg-muted @lg:inline">Used {token.lastUsed}</span>
                  <IconButton label={`Revoke ${token.name}`} variant="ghost" size="sm" onClick={() => revoke(token)}>
                    <TrashIcon />
                  </IconButton>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-2 border-t border-hairline px-4 py-8 text-center">
              <p className="text-fg-muted">Every token is revoked.</p>
              <Button size="sm" variant="ghost" onClick={() => setTokens(initial)}>
                Bring the samples back
              </Button>
            </div>
          )}
        </section>

        <section
          aria-labelledby="toast-deck-history"
          className="flex min-w-0 flex-col gap-3 rounded-xl bg-surface p-4 shadow-card"
        >
          <div>
            <h2 id="toast-deck-history" className="text-sb-md font-semibold">
              Recent
            </h2>
            <p className="text-sb-sm text-fg-muted">What the toasts said this session.</p>
          </div>
          {history.length ? (
            <ol className="flex flex-col gap-2.5" aria-label="Recent notifications">
              {history.map((s) => (
                <li key={s.key} className="flex items-start gap-2.5">
                  <StatusGlyph tone={s.tone} className="mt-1.5" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sb-sm font-semibold">{s.title}</p>
                    {s.description ? <p className="line-clamp-2 text-sb-sm text-fg-muted">{s.description}</p> : null}
                  </div>
                  <time
                    className="shrink-0 text-sb-xs text-fg-muted tabular-nums"
                    dateTime={new Date(s.at).toISOString()}
                  >
                    {clock(s.at)}
                  </time>
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-lg bg-well px-3 py-4 text-center text-sb-sm text-fg-muted shadow-tray">
              Nothing yet. Revoke a token or deploy.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
