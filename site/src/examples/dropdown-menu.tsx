import { useState } from "react";
import { Button } from "../../../src/components/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../src/components/dropdown-menu";
import type { Example, Playground, Preview } from "./types";

function Choices() {
  const [region, setRegion] = useState("eu-west");
  const [alerts, setAlerts] = useState(true);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button>View options</Button>} />
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Region</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={region} onValueChange={setRegion}>
            <DropdownMenuRadioItem value="eu-west">eu-west</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="us-east">us-east</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem checked={alerts} onCheckedChange={setAlerts}>
          Deploy alerts
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const examples: Example[] = [
  {
    title: "Menu",
    description:
      "Arrow keys move, Enter picks, Escape closes. A disabled item is skipped; destructive ones sit last, after a separator.",
    render: () => (
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button>Actions</Button>} />
        <DropdownMenuContent>
          <DropdownMenuItem>Rename</DropdownMenuItem>
          <DropdownMenuItem>Duplicate</DropdownMenuItem>
          <DropdownMenuItem disabled>Transfer</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
    code: `<DropdownMenu>
  <DropdownMenuTrigger render={<Button>Actions</Button>} />
  <DropdownMenuContent>
    <DropdownMenuItem>Rename</DropdownMenuItem>
    <DropdownMenuItem>Duplicate</DropdownMenuItem>
    <DropdownMenuItem disabled>Transfer</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem>Delete</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>`,
  },
  {
    title: "Destructive item",
    render: () => (
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button>robin</Button>} />
        <DropdownMenuContent>
          <DropdownMenuItem>Redeploy</DropdownMenuItem>
          <DropdownMenuItem>Roll back</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive>Delete sprout</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
    code: `<DropdownMenu>
  <DropdownMenuTrigger render={<Button>robin</Button>} />
  <DropdownMenuContent>
    <DropdownMenuItem>Redeploy</DropdownMenuItem>
    <DropdownMenuItem>Roll back</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem destructive>Delete sprout</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>`,
  },
  {
    title: "Radio and checkbox items",
    description:
      "With either kind present every item shares one gutter, so labels line up whether or not a row shows a check.",
    render: () => <Choices />,
    code: `const [region, setRegion] = useState("eu-west");
const [alerts, setAlerts] = useState(true);

<DropdownMenu>
  <DropdownMenuTrigger render={<Button>View options</Button>} />
  <DropdownMenuContent>
    <DropdownMenuGroup>
      <DropdownMenuLabel>Region</DropdownMenuLabel>
      <DropdownMenuRadioGroup value={region} onValueChange={setRegion}>
        <DropdownMenuRadioItem value="eu-west">eu-west</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="us-east">us-east</DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuGroup>
    <DropdownMenuSeparator />
    <DropdownMenuCheckboxItem checked={alerts} onCheckedChange={setAlerts}>
      Deploy alerts
    </DropdownMenuCheckboxItem>
  </DropdownMenuContent>
</DropdownMenu>`,
  },
];

const sides = ["top", "bottom", "left", "right"] as const;
const aligns = ["start", "center", "end"] as const;

/** The prop playground at the top of the page. */
export const playground: Playground = {
  component: "DropdownMenu",
  controls: [
    { prop: "side", kind: "select", options: sides, default: "bottom" },
    { prop: "align", kind: "select", options: aligns, default: "end" },
    { prop: "destructive", kind: "boolean", default: false },
    { prop: "disabled", kind: "boolean", default: false },
  ],
  initial: { destructive: true },
  render: (v) => (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button>Actions</Button>} />
      <DropdownMenuContent side={v.side as (typeof sides)[number]} align={v.align as (typeof aligns)[number]}>
        <DropdownMenuItem>Rename</DropdownMenuItem>
        <DropdownMenuItem disabled={Boolean(v.disabled)}>Duplicate</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive={Boolean(v.destructive)}>Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
  code: (v) => {
    const content = [
      v.side !== "bottom" ? ` side="${v.side}"` : "",
      v.align !== "end" ? ` align="${v.align}"` : "",
    ].join("");
    return `<DropdownMenu>
  <DropdownMenuTrigger render={<Button>Actions</Button>} />
  <DropdownMenuContent${content}>
    <DropdownMenuItem>Rename</DropdownMenuItem>
    <DropdownMenuItem${v.disabled ? " disabled" : ""}>Duplicate</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem${v.destructive ? " destructive" : ""}>Delete</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>`;
  },
};

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="flex w-44 flex-col rounded-xl bg-raised p-1 text-sb-sm shadow-float">
    <span className="rounded-md bg-hover px-2.5 py-1.5">Rename</span>
    <span className="px-2.5 py-1.5">Duplicate</span>
    <span className="my-1 h-px bg-hairline" />
    <span className="px-2.5 py-1.5 text-danger-fg">Delete</span>
  </div>
);
