/**
 * A recessed tray per project holding its sprouts as floating cards: each card has a status tile,
 * the hostname and one state line, and an empty project offers to plant its first sprout.
 */
import { buttonStyles } from "../../src/components/button";
import { StatusDot } from "../../src/components/status-dot";
import type { Status } from "../../src/components/status";
import { cn, focusRing } from "../../src/lib/cn";
import { formatCompact } from "../../src/lib/format";
import { ChevronRightIcon, PlusIcon } from "../../src/lib/icons";

export type SproutStatus = "live" | "deploying" | "deploy_failed" | "paused" | "not_deployed";

export interface Sprout {
  slug: string;
  name: string;
  hostname: string;
  status: SproutStatus;
  /** What wakes it: "http" for a web sprout, or "cron", "queue". Anything but http shows as a tag. */
  trigger?: string;
  /** The version serving traffic, if any. */
  liveVersion?: number;
  /** When the last deploy finished, already phrased: "12 min ago". */
  lastDeploy?: string;
  requests24h?: number;
}

export interface Project {
  slug: string;
  name: string;
  sprouts: Sprout[];
}

export interface ProjectTrayProps {
  projects?: Project[];
  /** Link to a project page. */
  projectHref?: (project: Project) => string;
  /** Link to a sprout page. */
  sproutHref?: (project: Project, sprout: Sprout) => string;
  /** Called by the "Sprout" button and the empty tray. */
  onNewSprout?: (project: Project) => void;
  className?: string;
}

/** Sample data: two projects with a mix of states, and a third that is still empty. */
export const sampleProjects: Project[] = [
  {
    slug: "pond",
    name: "Pond",
    sprouts: [
      {
        slug: "pond-web",
        name: "pond-web",
        hostname: "pond-web.lily.sproutboat.app",
        status: "live",
        liveVersion: 48,
        lastDeploy: "12 min ago",
        requests24h: 184_200,
      },
      {
        slug: "pond-api",
        name: "pond-api",
        hostname: "pond-api.lily.sproutboat.app",
        status: "deploying",
        liveVersion: 31,
        requests24h: 96_400,
      },
      {
        slug: "nightly-digest",
        name: "nightly-digest",
        hostname: "nightly-digest.lily.sproutboat.app",
        status: "live",
        trigger: "cron",
        liveVersion: 7,
        lastDeploy: "3 days ago",
      },
      {
        slug: "thumbnailer",
        name: "thumbnailer",
        hostname: "thumbnailer.lily.sproutboat.app",
        status: "deploy_failed",
        trigger: "queue",
        liveVersion: 12,
      },
    ],
  },
  {
    slug: "lily-pad",
    name: "Lily pad",
    sprouts: [
      {
        slug: "lily-pad-web",
        name: "lily-pad-web",
        hostname: "lily-pad-web.lily.sproutboat.app",
        status: "live",
        liveVersion: 5,
        lastDeploy: "yesterday",
        requests24h: 2_310,
      },
      {
        slug: "lily-pad-preview",
        name: "lily-pad-preview",
        hostname: "lily-pad-preview.lily.sproutboat.app",
        status: "paused",
      },
    ],
  },
  { slug: "reed", name: "Reed", sprouts: [] },
];

const look: Record<SproutStatus, { status: Status; live?: boolean; pulse?: boolean }> = {
  live: { status: "success", live: true },
  deploying: { status: "info", pulse: true },
  deploy_failed: { status: "danger" },
  paused: { status: "neutral" },
  not_deployed: { status: "neutral" },
};

/** "Live · deployed 12 min ago", "Deploy failed · v12 serving": the one line a card needs. */
export function stateLine(s: Sprout): string {
  switch (s.status) {
    case "live":
      return s.lastDeploy ? `Live · deployed ${s.lastDeploy}` : "Live";
    case "deploying":
      return s.liveVersion ? `Deploying · v${s.liveVersion} still live` : "Deploying the first version";
    case "deploy_failed":
      return s.liveVersion ? `Deploy failed · v${s.liveVersion} serving` : "Deploy failed";
    case "paused":
      return "Paused · answers 503";
    case "not_deployed":
      return "Not deployed yet";
  }
}

/** The sprout leaf on a soft tile, tinted by status. */
function SproutTile({ status }: { status: Status }) {
  const surface = {
    success: "bg-brand-soft text-brand-fg",
    info: "bg-info-soft text-info-fg",
    danger: "bg-danger-soft text-danger-fg",
    warning: "bg-warn-soft text-warn-fg",
    neutral: "bg-neutral-soft text-fg-muted",
  }[status];
  return (
    <span aria-hidden="true" className={cn("grid size-7 shrink-0 place-items-center rounded-lg", surface)}>
      <svg viewBox="3 6 24 25" className="size-4" fill="none">
        <path d="M16 29V15" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
        <path
          d="M16 16.5c0-4.7-3.8-8.5-8.5-8.5C6.7 8 6 8.7 6 9.5 6 14.2 9.8 18 14.5 18c.8 0 1.5-.7 1.5-1.5Z"
          fill="currentColor"
        />
        <path
          d="M16 15c0-4 3.2-7.2 7.2-7.2.7 0 1.3.6 1.3 1.3C24.5 12.8 21.3 16 17.3 16c-.7 0-1.3-.6-1.3-1Z"
          fill="currentColor"
          fillOpacity="0.72"
        />
      </svg>
    </span>
  );
}

function SproutCard({ sprout, href }: { sprout: Sprout; href: string }) {
  const l = look[sprout.status];
  return (
    <a
      href={href}
      className={cn(
        "flex min-w-0 flex-col gap-2.5 rounded-[0.6875rem] bg-surface p-3.5 pb-3 text-fg shadow-card",
        "transition-shadow duration-(--sb-duration-hover) ease-hover hover:shadow-float",
        focusRing,
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <SproutTile status={l.status} />
        <span className="min-w-0 flex-1 truncate text-base font-semibold">{sprout.name}</span>
        {sprout.trigger && sprout.trigger !== "http" ? (
          <span className="shrink-0 rounded-md bg-neutral-soft px-1.5 py-0.5 font-mono text-xs font-semibold text-neutral-fg">
            {sprout.trigger}
          </span>
        ) : null}
      </span>
      <span className="truncate font-mono text-xs text-fg-muted" title={sprout.hostname}>
        {sprout.hostname}
      </span>
      <span className="flex min-w-0 border-t border-hairline pt-2.5">
        <StatusDot
          status={l.status}
          live={l.live}
          pulse={l.pulse}
          label={stateLine(sprout)}
          className={cn(
            "min-w-0 truncate text-sm",
            sprout.status === "deploy_failed" ? "text-danger-fg" : "text-fg-muted",
          )}
        />
      </span>
    </a>
  );
}

const grid = "grid grid-cols-[repeat(auto-fill,minmax(12.75rem,1fr))] gap-1.5";

function Tray({
  project,
  href,
  sproutHref,
  onNewSprout,
}: {
  project: Project;
  href: string;
  sproutHref: (sprout: Sprout) => string;
  onNewSprout: () => void;
}) {
  const requests = project.sprouts.reduce((sum, s) => sum + (s.requests24h ?? 0), 0);
  const id = `tray-${project.slug}`;
  const count = project.sprouts.length;
  return (
    <section
      aria-labelledby={id}
      className="@container rounded-2xl bg-well p-1.5 shadow-[inset_0_0_0_1px_var(--sb-hairline)]"
    >
      <div className="flex min-w-0 items-center gap-2.5 px-3 pt-2 pb-2.5">
        <h2 id={id} className="min-w-0 truncate text-md font-semibold">
          <a href={href} className={cn("rounded-sm hover:underline", focusRing)}>
            {project.name}
          </a>
        </h2>
        <span className="shrink-0 text-sm text-fg-muted">
          {count} {count === 1 ? "sprout" : "sprouts"}
        </span>
        <span className="ms-auto flex shrink-0 items-center gap-1">
          {requests > 0 ? (
            <span className="me-2 hidden text-sm text-fg-muted tabular-nums @xl:inline">
              {formatCompact(requests)} requests, 24 h
            </span>
          ) : null}
          <button
            type="button"
            onClick={onNewSprout}
            className={buttonStyles({ variant: "ghost", size: "sm" })}
            aria-label={`New sprout in ${project.name}`}
          >
            <PlusIcon />
            Sprout
          </button>
          <a
            href={href}
            className={cn(buttonStyles({ variant: "ghost", size: "sm" }), "size-(--sb-control-h-sm) px-0")}
            aria-label={`Open ${project.name}`}
          >
            <ChevronRightIcon />
          </a>
        </span>
      </div>
      {count ? (
        <div className={grid}>
          {project.sprouts.map((s) => (
            <SproutCard key={s.slug} sprout={s} href={sproutHref(s)} />
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={onNewSprout}
          className={cn(
            "flex min-h-24 w-full flex-col items-center justify-center gap-1 rounded-[0.6875rem] p-4 text-center text-sm text-fg-muted",
            "border border-dashed border-hairline-strong",
            "transition-colors duration-(--sb-duration-hover) ease-hover hover:bg-hover hover:text-fg",
            focusRing,
          )}
        >
          <span className="inline-flex items-center gap-1.5 font-semibold text-fg">
            <PlusIcon />
            Plant the first sprout
          </span>
          Start from a template, a repository or the CLI.
        </button>
      )}
    </section>
  );
}

export function ProjectTray({
  projects = sampleProjects,
  projectHref = (p) => `#${p.slug}`,
  sproutHref = (p, s) => `#${p.slug}/${s.slug}`,
  onNewSprout = () => {},
  className,
}: ProjectTrayProps) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {projects.map((project) => (
        <Tray
          key={project.slug}
          project={project}
          href={projectHref(project)}
          sproutHref={(s) => sproutHref(project, s)}
          onNewSprout={() => onNewSprout(project)}
        />
      ))}
    </div>
  );
}
