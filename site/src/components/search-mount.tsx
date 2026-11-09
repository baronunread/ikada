/**
 * The docs search: ikada's CommandPalette over every page in the sidebar. Loaded by chrome.ts the
 * first time someone presses the search button or ⌘K, so no page pays for it up front.
 */
import { useState } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { CommandPalette, useCommandPaletteShortcut } from "../../../src/components/command-palette";
import type { PaletteGroup } from "../../../src/components/command-palette";

interface Page {
  group: string;
  label: string;
  href: string;
}

const svg = (children: ReactNode) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);
/** One glyph per kind of page, so the type reads at a glance instead of as a mono tag. */
const icons: Record<string, ReactNode> = {
  "Get started": svg(
    <>
      <path d="M4 2.5h5.5L12.5 5.5v8h-8.5z" />
      <path d="M9 2.5v3.5h3.5M6 9h4M6 11.2h4" />
    </>,
  ),
  Components: svg(
    <>
      <path d="M8 2 13.5 5v6L8 14 2.5 11V5z" />
      <path d="M2.7 5.1 8 8l5.3-2.9M8 8v6" />
    </>,
  ),
  Blocks: svg(
    <>
      <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
      <path d="M2.5 6.5h11M6.5 6.5v7" />
    </>,
  ),
};
const fallback = svg(<path d="M3 8h10M8 3v10" />);

function Search({ groups, register }: { groups: PaletteGroup[]; register: (open: () => void) => void }) {
  const [open, setOpen] = useState(false);
  register(() => setOpen(true));
  useCommandPaletteShortcut(() => setOpen((o) => !o));
  return (
    <CommandPalette
      open={open}
      onOpenChange={setOpen}
      groups={groups}
      label="Search the docs"
      placeholder="Search components, blocks and guides…"
      onSelect={(item) => {
        location.href = item.id;
      }}
    />
  );
}

export function mountSearch(_opener?: HTMLElement): () => void {
  const pages = JSON.parse(document.getElementById("search-pages")?.textContent ?? "[]") as Page[];
  const byGroup = new Map<string, Page[]>();
  for (const p of pages) byGroup.set(p.group, [...(byGroup.get(p.group) ?? []), p]);
  const groups: PaletteGroup[] = [...byGroup].map(([label, list]) => ({
    id: label,
    label,
    items: list.map((p) => ({
      id: p.href,
      label: p.label,
      icon: icons[label] ?? fallback,
      keywords: p.href,
    })),
  }));
  let open: () => void = () => {};
  const host = document.createElement("div");
  document.body.append(host);
  let ready!: () => void;
  const mounted = new Promise<void>((r) => (ready = r));
  createRoot(host).render(
    <Search
      groups={groups}
      register={(fn) => {
        open = fn;
        ready();
      }}
    />,
  );
  return () => void mounted.then(() => open());
}
