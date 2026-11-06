import { Button } from "../../../src/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../src/components/dropdown-menu";
import type { Example, Preview } from "./types";

export const examples: Example[] = [
  {
    title: "Menu",
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
  },
];

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="flex w-44 flex-col rounded-xl bg-raised p-1 text-sm shadow-float">
    <span className="rounded-md bg-hover px-2.5 py-1.5">Rename</span>
    <span className="px-2.5 py-1.5">Duplicate</span>
    <span className="my-1 h-px bg-hairline" />
    <span className="px-2.5 py-1.5 text-danger-fg">Delete</span>
  </div>
);
