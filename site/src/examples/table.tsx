import { useState } from "react";
import { Button } from "../../../src/components/button";
import { StatusDot } from "../../../src/components/status-dot";
import {
  nextSort,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableError,
  TableHead,
  TableHeader,
  TableLoading,
  TableRow,
  type SortDirection,
} from "../../../src/components/table";
import type { Example, Preview } from "./types";

const sprouts = [
  { name: "robin", region: "eu-west", status: "Live", updated: "3 min ago" },
  { name: "wren", region: "us-east", status: "Live", updated: "2 h ago" },
  { name: "finch", region: "eu-west", status: "Building", updated: "just now" },
  { name: "heron", region: "us-east", status: "Paused", updated: "5 days ago" },
];

function Sortable() {
  const [sort, setSort] = useState<SortDirection | undefined>("asc");
  const rows = sort === "desc" ? [...sprouts].reverse() : sprouts;
  return (
    <Table label="Sprouts">
      <TableHeader>
        <TableRow>
          <TableHead sortable sort={sort} onSort={() => setSort(nextSort(sort))}>
            Name
          </TableHead>
          <TableHead>Region</TableHead>
          <TableHead hideBelow="md">Updated</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((s) => (
          <TableRow key={s.name}>
            <TableCell>{s.name}</TableCell>
            <TableCell>{s.region}</TableCell>
            <TableCell hideBelow="md">{s.updated}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export const examples: Example[] = [
  {
    title: "Basic",
    description: "Wide tables scroll inside their container, never the page. 48px rows.",
    render: () => (
      <Table label="Sprouts">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Region</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>robin</TableCell>
            <TableCell>eu-west</TableCell>
            <TableCell>
              <StatusDot tone="success" live label="Live" />
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell>wren</TableCell>
            <TableCell>us-east</TableCell>
            <TableCell>
              <StatusDot tone="success" live label="Live" />
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell>finch</TableCell>
            <TableCell>eu-west</TableCell>
            <TableCell>
              <StatusDot tone="info" pulse label="Building" />
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell>heron</TableCell>
            <TableCell>us-east</TableCell>
            <TableCell>
              <StatusDot tone="neutral" label="Paused" />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    ),
    code: `<Table label="Sprouts">
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Region</TableHead>
      <TableHead>Status</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>robin</TableCell>
      <TableCell>eu-west</TableCell>
      <TableCell>
        <StatusDot tone="success" live label="Live" />
      </TableCell>
    </TableRow>
    <TableRow>
      <TableCell>wren</TableCell>
      <TableCell>us-east</TableCell>
      <TableCell>
        <StatusDot tone="success" live label="Live" />
      </TableCell>
    </TableRow>
    <TableRow>
      <TableCell>finch</TableCell>
      <TableCell>eu-west</TableCell>
      <TableCell>
        <StatusDot tone="info" pulse label="Building" />
      </TableCell>
    </TableRow>
    <TableRow>
      <TableCell>heron</TableCell>
      <TableCell>us-east</TableCell>
      <TableCell>
        <StatusDot tone="neutral" label="Paused" />
      </TableCell>
    </TableRow>
  </TableBody>
</Table>`,
  },
  {
    title: "Sortable",
    description:
      "A sortable header holds a button and sets aria-sort. nextSort cycles none, ascending, descending. Updated hides below the container's md width.",
    render: () => <Sortable />,
    code: `const [sort, setSort] = useState<SortDirection | undefined>("asc");
// rows: your data, ordered by sort (descending reverses it)
const rows = [
  { name: "robin", region: "eu-west", updated: "3 min ago" },
  { name: "wren", region: "us-east", updated: "2 h ago" },
];

<Table label="Sprouts">
  <TableHeader>
    <TableRow>
      <TableHead sortable sort={sort} onSort={() => setSort(nextSort(sort))}>
        Name
      </TableHead>
      <TableHead>Region</TableHead>
      <TableHead hideBelow="md">Updated</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {rows.map((s) => (
      <TableRow key={s.name}>
        <TableCell>{s.name}</TableCell>
        <TableCell>{s.region}</TableCell>
        <TableCell hideBelow="md">{s.updated}</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>`,
  },
  {
    title: "Selected row",
    description: "Highlights the row and sets aria-selected. Pair it with a checkbox cell: that is the control.",
    render: () => (
      <Table label="Sprouts">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Region</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow selected>
            <TableCell>robin</TableCell>
            <TableCell>eu-west</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>wren</TableCell>
            <TableCell>us-east</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    ),
    code: `<Table label="Sprouts">
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Region</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow selected>
      <TableCell>robin</TableCell>
      <TableCell>eu-west</TableCell>
    </TableRow>
    <TableRow>
      <TableCell>wren</TableCell>
      <TableCell>us-east</TableCell>
    </TableRow>
  </TableBody>
</Table>`,
  },
  {
    title: "Sticky header",
    description: "The header stays put while the body scrolls. Pair stickyHeader with a maxHeight.",
    render: () => (
      <Table label="Sprouts" stickyHeader maxHeight="9rem">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Region</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sprouts.concat(sprouts).map((s, i) => (
            <TableRow key={i}>
              <TableCell>{s.name}</TableCell>
              <TableCell>{s.region}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    ),
    code: `const sprouts = [
  { name: "robin", region: "eu-west" },
  { name: "wren", region: "us-east" },
  // …
];

<Table label="Sprouts" stickyHeader maxHeight="9rem">
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Region</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {sprouts.map((s) => (
      <TableRow key={s.name}>
        <TableCell>{s.name}</TableCell>
        <TableCell>{s.region}</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>`,
  },
  {
    title: "Loading",
    description: "Skeleton rows keep the layout of the loaded table. Mark the table aria-busy.",
    render: () => (
      <Table label="Sprouts" aria-busy="true">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Region</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableLoading columns={3} rows={3} />
        </TableBody>
      </Table>
    ),
    code: `<Table label="Sprouts" aria-busy="true">
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Region</TableHead>
      <TableHead>Status</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableLoading columns={3} rows={3} />
  </TableBody>
</Table>`,
  },
  {
    title: "Empty",
    render: () => (
      <Table label="Sprouts">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Region</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableEmpty colSpan={2}>No sprouts yet. Plant your first one.</TableEmpty>
        </TableBody>
      </Table>
    ),
    code: `<Table label="Sprouts">
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Region</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableEmpty colSpan={2}>No sprouts yet. Plant your first one.</TableEmpty>
  </TableBody>
</Table>`,
  },
  {
    title: "Error",
    render: () => (
      <Table label="Sprouts">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Region</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableError colSpan={2} action={<Button size="sm">Retry</Button>}>
            The API did not answer in time.
          </TableError>
        </TableBody>
      </Table>
    ),
    code: `<Table label="Sprouts">
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Region</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableError colSpan={2} action={<Button size="sm">Retry</Button>}>
      The API did not answer in time.
    </TableError>
  </TableBody>
</Table>`,
  },
];

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="w-60 text-sb-sm">
    <div className="flex border-b border-hairline py-1.5 text-fg-muted">
      <span className="flex-1">Version</span>
      <span>Status</span>
    </div>
    <div className="flex border-b border-hairline py-1.5">
      <span className="flex-1">v48</span>
      <span className="text-brand-fg">Live</span>
    </div>
    <div className="flex py-1.5">
      <span className="flex-1">v47</span>
      <span className="text-fg-muted">Ready</span>
    </div>
  </div>
);
