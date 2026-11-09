import { Badge } from "../../../src/components/badge";
import { Breadcrumbs } from "../../../src/components/breadcrumbs";
import { Button } from "../../../src/components/button";
import { PageHeader, PageTab, PageTabs } from "../../../src/components/page-header";
import { StatusDot } from "../../../src/components/status-dot";
import { demo } from "../lib/demo-href";
import type { Example, Playground, Preview } from "./types";

const trail = [
  { label: "Sproutboat", href: demo.home },
  { label: "robin", href: demo.projects },
  { label: "Overview" },
];

export const examples: Example[] = [
  {
    title: "Title and actions",
    description: "The title is the page's only h1. Actions sit on the right and wrap under it on narrow screens.",
    render: () => (
      <PageHeader
        title="robin"
        description="robin.sproutboat.app"
        actions={
          <>
            <Button>Visit</Button>
            <Button variant="primary">Deploy</Button>
          </>
        }
        className="w-full"
      />
    ),
    code: `<PageHeader
  title="robin"
  description="robin.sproutboat.app"
  actions={
    <>
      <Button>Visit</Button>
      <Button variant="primary">Deploy</Button>
    </>
  }
/>`,
  },
  {
    title: "Breadcrumbs and status",
    render: () => (
      <PageHeader
        breadcrumbs={<Breadcrumbs items={trail} />}
        title="wren"
        status={<StatusDot status="success" live label="Live" />}
        description="eu-west · main · 3 minutes ago"
        className="w-full"
      />
    ),
    code: `<PageHeader
  breadcrumbs={
    <Breadcrumbs
      items={[
        { label: "Sproutboat", href: "/" },
        { label: "wren", href: "/sprouts/wren" },
        { label: "Overview" },
      ]}
    />
  }
  title="wren"
  status={<StatusDot status="success" live label="Live" />}
  description="eu-west · main · 3 minutes ago"
/>`,
  },
  {
    title: "With tabs",
    description: "PageTabs sit on the header's bottom rule; the current tab carries the underline.",
    render: () => (
      <PageHeader
        title="finch"
        status={<Badge tone="info">Building</Badge>}
        description="finch.sproutboat.app"
        actions={<Button variant="primary">Deploy</Button>}
        tabs={
          <PageTabs>
            <PageTab href={demo.metrics} current>
              Overview
            </PageTab>
            <PageTab href={demo.deployments}>Deployments</PageTab>
            <PageTab href={demo.logs}>Logs</PageTab>
            <PageTab href={demo.settings}>Settings</PageTab>
          </PageTabs>
        }
        className="w-full"
      />
    ),
    code: `<PageHeader
  title="finch"
  status={<Badge tone="info">Building</Badge>}
  description="finch.sproutboat.app"
  actions={<Button variant="primary">Deploy</Button>}
  tabs={
    <PageTabs>
      <PageTab href="/sprouts/finch" current>
        Overview
      </PageTab>
      <PageTab href="/sprouts/finch/deployments">Deployments</PageTab>
      <PageTab href="/sprouts/finch/logs">Logs</PageTab>
      <PageTab href="/sprouts/finch/settings">Settings</PageTab>
    </PageTabs>
  }
/>`,
  },
];

/** The prop playground at the top of the page. */
export const playground: Playground = {
  component: "PageHeader",
  controls: [
    { prop: "title", kind: "text", default: "" },
    { prop: "description", kind: "text", default: "" },
    { prop: "breadcrumbs", kind: "boolean", default: false },
    { prop: "status", kind: "boolean", default: false },
    { prop: "actions", kind: "boolean", default: false },
    { prop: "tabs", kind: "boolean", default: false },
  ],
  initial: { title: "heron", description: "heron.sproutboat.app", status: true, actions: true },
  render: (v) => (
    <PageHeader
      title={String(v.title)}
      description={v.description ? String(v.description) : undefined}
      breadcrumbs={v.breadcrumbs ? <Breadcrumbs items={trail} /> : undefined}
      status={v.status ? <StatusDot status="success" live label="Live" /> : undefined}
      actions={v.actions ? <Button variant="primary">Deploy</Button> : undefined}
      tabs={
        v.tabs ? (
          <PageTabs>
            <PageTab href={demo.metrics} current>
              Overview
            </PageTab>
            <PageTab href={demo.logs}>Logs</PageTab>
          </PageTabs>
        ) : undefined
      }
      className="w-full"
    />
  ),
  code: (v) => {
    const props = [
      v.breadcrumbs
        ? `  breadcrumbs={<Breadcrumbs items={[{ label: "Sproutboat", href: "/" }, { label: "heron" }]} />}`
        : "",
      `  title="${v.title}"`,
      v.status ? `  status={<StatusDot status="success" live label="Live" />}` : "",
      v.description ? `  description="${v.description}"` : "",
      v.actions ? `  actions={<Button variant="primary">Deploy</Button>}` : "",
      v.tabs
        ? `  tabs={\n    <PageTabs>\n      <PageTab href="/" current>Overview</PageTab>\n      <PageTab href="/logs">Logs</PageTab>\n    </PageTabs>\n  }`
        : "",
    ].filter(Boolean);
    return `<PageHeader\n${props.join("\n")}\n/>`;
  },
};

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="flex w-60 items-end justify-between gap-3 border-b border-hairline pb-2">
    <div>
      <p className="text-sb-xs text-fg-muted">acme / web</p>
      <p className="text-sb-lg font-semibold">Overview</p>
    </div>
    <Button size="sm" variant="primary">
      Deploy
    </Button>
  </div>
);
