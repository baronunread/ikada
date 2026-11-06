/**
 * The docs search: ikada's CommandPalette over every page in the sidebar. Loaded by chrome.ts the
 * first time someone presses the search button or ⌘K, so no page pays for it up front.
 */
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { CommandPalette, useCommandPaletteShortcut } from "../../../src/components/command-palette";
import type { PaletteGroup } from "../../../src/components/command-palette";

interface Page {
  group: string;
  label: string;
  href: string;
}

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
      hint: label === "Get started" ? "Guide" : label.replace(/s$/, ""),
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
