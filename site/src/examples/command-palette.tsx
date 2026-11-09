import { useState } from "react";
import { Button } from "../../../src/components/button";
import {
  CommandPalette,
  shortcutLabel,
  useCommandPaletteShortcut,
  type PaletteGroup,
  type PaletteItem,
  type PalettePrefix,
} from "../../../src/components/command-palette";
import { Kbd } from "../../../src/components/kbd";
import { DatabaseIcon, RocketIcon, SearchIcon } from "../../../src/lib/icons";
import type { Example, Preview } from "./types";

const groups: PaletteGroup[] = [
  {
    id: "sprouts",
    label: "Sprouts",
    items: [
      { id: "robin", label: "robin", hint: "eu-west · production", icon: <RocketIcon /> },
      { id: "wren", label: "wren", hint: "us-east · production", icon: <RocketIcon /> },
      { id: "finch", label: "finch", hint: "eu-west · staging", icon: <RocketIcon /> },
    ],
  },
  {
    id: "databases",
    label: "Databases",
    items: [
      { id: "heron-db", label: "heron-db", hint: "eu-west", icon: <DatabaseIcon />, scope: "d1" },
      { id: "wren-db", label: "wren-db", hint: "us-east", icon: <DatabaseIcon />, scope: "d1" },
    ],
  },
];

const recents: PaletteItem[] = [
  { id: "robin-recent", label: "robin", hint: "eu-west · production", icon: <RocketIcon /> },
];

const prefixes: PalettePrefix[] = [{ scope: "d1", label: "D1 databases" }];

function Demo({ withPrefixes }: { withPrefixes: boolean }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState("nothing yet");
  useCommandPaletteShortcut(() => setOpen((o) => !o));
  return (
    <div className="flex items-center gap-3">
      <Button onClick={() => setOpen(true)} aria-keyshortcuts="Meta+K Control+K">
        <SearchIcon />
        Search
        <Kbd aria-hidden="true">{shortcutLabel()}</Kbd>
      </Button>
      <span className="text-sb-sm text-fg-muted">Picked: {picked}</span>
      <CommandPalette
        open={open}
        onOpenChange={setOpen}
        groups={groups}
        recents={recents}
        prefixes={withPrefixes ? prefixes : undefined}
        onSelect={(item) => setPicked(item.label)}
      />
    </div>
  );
}

export const examples: Example[] = [
  {
    title: "Search and jump",
    description:
      "Opens with the button or the shortcut. Arrow keys move, Enter picks, Escape closes. Results are filtered as you type.",
    render: () => <Demo withPrefixes={false} />,
    code: `const groups = [
  {
    id: "sprouts",
    label: "Sprouts",
    items: [
      { id: "robin", label: "robin", hint: "eu-west · production", icon: <RocketIcon /> },
      { id: "wren", label: "wren", hint: "us-east · production", icon: <RocketIcon /> },
      { id: "finch", label: "finch", hint: "eu-west · staging", icon: <RocketIcon /> },
    ],
  },
];

function Search() {
  const [open, setOpen] = useState(false);
  useCommandPaletteShortcut(() => setOpen((o) => !o));
  return (
    <>
      <Button onClick={() => setOpen(true)} aria-keyshortcuts="Meta+K Control+K">
        <SearchIcon />
        Search
        <Kbd aria-hidden="true">{shortcutLabel()}</Kbd>
      </Button>
      <CommandPalette
        open={open}
        onOpenChange={setOpen}
        groups={groups}
        onSelect={(item) => navigate(item.id)}
      />
    </>
  );
}`,
  },
  {
    title: "Recents and prefixes",
    description: "Recents show while the query is empty. Type d1: to narrow the search to one kind of thing.",
    render: () => <Demo withPrefixes />,
    code: `const groups = [
  {
    id: "sprouts",
    label: "Sprouts",
    items: [
      { id: "robin", label: "robin", hint: "eu-west · production", icon: <RocketIcon /> },
      { id: "wren", label: "wren", hint: "us-east · production", icon: <RocketIcon /> },
    ],
  },
  {
    id: "databases",
    label: "Databases",
    items: [
      { id: "heron-db", label: "heron-db", hint: "eu-west", icon: <DatabaseIcon />, scope: "d1" },
      { id: "wren-db", label: "wren-db", hint: "us-east", icon: <DatabaseIcon />, scope: "d1" },
    ],
  },
];
const recents = [{ id: "robin-recent", label: "robin", hint: "eu-west · production", icon: <RocketIcon /> }];
const prefixes = [{ scope: "d1", label: "D1 databases" }];

<CommandPalette
  open={open}
  onOpenChange={setOpen}
  groups={groups}
  recents={recents}
  prefixes={prefixes}
  onSelect={(item) => navigate(item.id)}
/>`,
  },
];

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="flex w-60 items-center gap-2 rounded-xl bg-raised px-3 py-2.5 text-sb-sm text-fg-muted shadow-float">
    <SearchIcon />
    <span className="flex-1">Search projects…</span>
    <Kbd>⌘K</Kbd>
  </div>
);
