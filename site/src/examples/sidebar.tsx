import { Badge } from "../../../src/components/badge";
import {
  Sidebar,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarNav,
  SidebarToggle,
  SidebarTrigger,
  useSidebarState,
} from "../../../src/components/sidebar";
import { FolderIcon, HomeIcon, LogsIcon } from "../../../src/lib/icons";
import { demo } from "../lib/demo-href";
import type { Example, Playground, Preview } from "./types";

const pages = ["home", "projects", "logs"] as const;

function Column({ collapsible = false }: { collapsible?: boolean }) {
  const { collapsed, setCollapsed } = useSidebarState();
  return (
    <div className="h-72 overflow-hidden rounded-xl shadow-card">
      <Sidebar mode="static" collapsed={collapsible && collapsed}>
        <SidebarHeader>
          <span className="truncate font-semibold">Sproutboat</span>
        </SidebarHeader>
        <SidebarNav label="Account">
          <SidebarItem href={demo.home} icon={<HomeIcon />} current>
            Home
          </SidebarItem>
          <SidebarItem href={demo.projects} icon={<FolderIcon />} trailing={<Badge>4</Badge>}>
            Sprouts
          </SidebarItem>
          <SidebarItem href={demo.logs} icon={<LogsIcon />}>
            Logs
          </SidebarItem>
        </SidebarNav>
        {collapsible ? (
          <SidebarFooter>
            <SidebarToggle collapsed={collapsed} onCollapsedChange={setCollapsed} />
          </SidebarFooter>
        ) : null}
      </Sidebar>
    </div>
  );
}

function Drawer() {
  const { open, setOpen } = useSidebarState();
  return (
    <>
      <SidebarTrigger onClick={() => setOpen(true)} />
      <Sidebar mode="drawer" open={open} onOpenChange={setOpen}>
        <SidebarHeader>
          <span className="truncate font-semibold">Sproutboat</span>
        </SidebarHeader>
        <SidebarNav label="Account">
          <SidebarItem href={demo.home} icon={<HomeIcon />} current>
            Home
          </SidebarItem>
          <SidebarItem href={demo.projects} icon={<FolderIcon />}>
            Sprouts
          </SidebarItem>
          <SidebarItem href={demo.logs} icon={<LogsIcon />}>
            Logs
          </SidebarItem>
        </SidebarNav>
      </Sidebar>
    </>
  );
}

export const examples: Example[] = [
  {
    title: "Column",
    description: "On desktop a 240px column with a header, a flat nav and an optional footer.",
    render: () => <Column />,
    code: `<Sidebar mode="static">
  <SidebarHeader>
    <span className="truncate font-semibold">Sproutboat</span>
  </SidebarHeader>
  <SidebarNav label="Account">
    <SidebarItem href="/" icon={<HomeIcon />} current>
      Home
    </SidebarItem>
    <SidebarItem href="/sprouts" icon={<FolderIcon />} trailing={<Badge>4</Badge>}>
      Sprouts
    </SidebarItem>
    <SidebarItem href="/logs" icon={<LogsIcon />}>
      Logs
    </SidebarItem>
  </SidebarNav>
</Sidebar>`,
  },
  {
    title: "Rail",
    description: "Collapses to a 56px icon rail. Labels stay as accessible names and show in a tooltip.",
    render: () => <Column collapsible />,
    code: `const { collapsed, setCollapsed } = useSidebarState();

<Sidebar mode="static" collapsed={collapsed}>
  <SidebarHeader>
    <span className="truncate font-semibold">Sproutboat</span>
  </SidebarHeader>
  <SidebarNav label="Account">
    <SidebarItem href="/" icon={<HomeIcon />} current>
      Home
    </SidebarItem>
    <SidebarItem href="/sprouts" icon={<FolderIcon />} trailing={<Badge>4</Badge>}>
      Sprouts
    </SidebarItem>
    <SidebarItem href="/logs" icon={<LogsIcon />}>
      Logs
    </SidebarItem>
  </SidebarNav>
  <SidebarFooter>
    <SidebarToggle collapsed={collapsed} onCollapsedChange={setCollapsed} />
  </SidebarFooter>
</Sidebar>`,
  },
  {
    title: "Drawer",
    description:
      "On narrow screens it is a modal drawer: it traps focus, closes on Escape and returns focus to the trigger.",
    render: () => <Drawer />,
    code: `const { open, setOpen } = useSidebarState();

<SidebarTrigger onClick={() => setOpen(true)} />
<Sidebar mode="drawer" open={open} onOpenChange={setOpen}>
  <SidebarHeader>
    <span className="truncate font-semibold">Sproutboat</span>
  </SidebarHeader>
  <SidebarNav label="Account">
    <SidebarItem href="/" icon={<HomeIcon />} current>
      Home
    </SidebarItem>
    <SidebarItem href="/sprouts" icon={<FolderIcon />}>
      Sprouts
    </SidebarItem>
    <SidebarItem href="/logs" icon={<LogsIcon />}>
      Logs
    </SidebarItem>
  </SidebarNav>
</Sidebar>`,
  },
];

const labels = { home: "Home", projects: "Sprouts", logs: "Logs" } as const;
const icons = { home: <HomeIcon />, projects: <FolderIcon />, logs: <LogsIcon /> } as const;
const liveHrefs = { home: demo.home, projects: demo.projects, logs: demo.logs } as const;
const hrefs = { home: "/", projects: "/sprouts", logs: "/logs" } as const;
const iconNames = { home: "HomeIcon", projects: "FolderIcon", logs: "LogsIcon" } as const;

function PlaygroundSidebar({ collapsed, current, count }: { collapsed: boolean; current: string; count: boolean }) {
  return (
    <div className="h-72 overflow-hidden rounded-xl shadow-card">
      <Sidebar mode="static" collapsed={collapsed}>
        <SidebarHeader>
          <span className="truncate font-semibold">Sproutboat</span>
        </SidebarHeader>
        <SidebarNav label="Account">
          {pages.map((page) => (
            <SidebarItem
              key={page}
              href={liveHrefs[page]}
              icon={icons[page]}
              current={current === page}
              trailing={count && page === "projects" ? <Badge>4</Badge> : undefined}
            >
              {labels[page]}
            </SidebarItem>
          ))}
        </SidebarNav>
      </Sidebar>
    </div>
  );
}

/** The prop playground at the top of the page. */
export const playground: Playground = {
  component: "Sidebar",
  controls: [
    { prop: "collapsed", kind: "boolean", default: false },
    { prop: "current", kind: "select", options: pages, default: "home" },
    { prop: "trailing", kind: "boolean", default: false },
  ],
  initial: { current: "projects", trailing: true },
  render: (v) => (
    <PlaygroundSidebar collapsed={Boolean(v.collapsed)} current={String(v.current)} count={Boolean(v.trailing)} />
  ),
  code: (v) => {
    const items = pages
      .map((page) => {
        const props = [
          `href="${hrefs[page]}"`,
          `icon={<${iconNames[page]} />}`,
          v.current === page ? "current" : "",
          v.trailing && page === "projects" ? "trailing={<Badge>4</Badge>}" : "",
        ].filter(Boolean);
        return `    <SidebarItem ${props.join(" ")}>\n      ${labels[page]}\n    </SidebarItem>`;
      })
      .join("\n");
    return `<Sidebar mode="static"${v.collapsed ? " collapsed" : ""}>\n  <SidebarHeader>Sproutboat</SidebarHeader>\n  <SidebarNav label="Account">\n${items}\n  </SidebarNav>\n</Sidebar>`;
  },
};

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="flex w-44 flex-col gap-0.5 rounded-xl bg-surface p-2 text-sb-sm shadow-card">
    <span className="flex items-center gap-2 rounded-md bg-hover px-2 py-1.5 font-semibold">
      <HomeIcon /> Home
    </span>
    <span className="flex items-center gap-2 px-2 py-1.5 text-fg-muted">
      <FolderIcon /> Projects
    </span>
    <span className="flex items-center gap-2 px-2 py-1.5 text-fg-muted">
      <LogsIcon /> Logs
    </span>
  </div>
);
