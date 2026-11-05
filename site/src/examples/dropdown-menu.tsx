import { Button } from "../../../src/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../src/components/dropdown-menu";
import type { Example } from "./types";

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
