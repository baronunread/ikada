import { Button } from "../../../src/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "../../../src/components/dialog";
import type { Example, Playground, Preview } from "./types";

export const examples: Example[] = [
  {
    title: "Confirm",
    description:
      "Opens with a click on a spring from the centre; opened with a key it appears at once. Escape or Cancel closes.",
    render: () => (
      <Dialog>
        <DialogTrigger render={<Button variant="danger">Delete robin</Button>} />
        <DialogContent>
          <DialogTitle>Delete robin?</DialogTitle>
          <DialogDescription>
            robin.sproutboat.app stops serving traffic and its eu-west data is removed. This cannot be undone.
          </DialogDescription>
          <DialogFooter>
            <DialogClose render={<Button>Cancel</Button>} />
            <DialogClose render={<Button variant="danger">Delete</Button>} />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    ),
    code: `<Dialog>
  <DialogTrigger render={<Button variant="danger">Delete robin</Button>} />
  <DialogContent>
    <DialogTitle>Delete robin?</DialogTitle>
    <DialogDescription>
      robin.sproutboat.app stops serving traffic and its eu-west data is removed.
      This cannot be undone.
    </DialogDescription>
    <DialogFooter>
      <DialogClose render={<Button>Cancel</Button>} />
      <DialogClose render={<Button variant="danger">Delete</Button>} />
    </DialogFooter>
  </DialogContent>
</Dialog>`,
  },
  {
    title: "Without the corner close",
    description: "When the footer already has Cancel, hideClose drops the X.",
    render: () => (
      <Dialog>
        <DialogTrigger render={<Button>Move to us-east</Button>} />
        <DialogContent hideClose>
          <DialogTitle>Move wren to us-east?</DialogTitle>
          <DialogDescription>Traffic shifts once the new region passes its health check.</DialogDescription>
          <DialogFooter>
            <DialogClose render={<Button>Cancel</Button>} />
            <DialogClose render={<Button variant="primary">Move</Button>} />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    ),
    code: `<Dialog>
  <DialogTrigger render={<Button>Move to us-east</Button>} />
  <DialogContent hideClose>
    <DialogTitle>Move wren to us-east?</DialogTitle>
    <DialogDescription>
      Traffic shifts once the new region passes its health check.
    </DialogDescription>
    <DialogFooter>
      <DialogClose render={<Button>Cancel</Button>} />
      <DialogClose render={<Button variant="primary">Move</Button>} />
    </DialogFooter>
  </DialogContent>
</Dialog>`,
  },
];

/** The prop playground at the top of the page. */
export const playground: Playground = {
  component: "Dialog",
  controls: [
    { prop: "title", kind: "text", default: "" },
    { prop: "description", kind: "text", default: "" },
    { prop: "hideClose", kind: "boolean", default: false },
  ],
  initial: { title: "Delete robin?", description: "This cannot be undone." },
  render: (v) => (
    <Dialog>
      <DialogTrigger render={<Button>Open dialog</Button>} />
      <DialogContent hideClose={Boolean(v.hideClose)}>
        <DialogTitle>{String(v.title)}</DialogTitle>
        {v.description ? <DialogDescription>{String(v.description)}</DialogDescription> : null}
        <DialogFooter>
          <DialogClose render={<Button>Cancel</Button>} />
          <DialogClose render={<Button variant="primary">Confirm</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
  code: (v) => `<Dialog>
  <DialogTrigger render={<Button>Open dialog</Button>} />
  <DialogContent${v.hideClose ? " hideClose" : ""}>
    <DialogTitle>${String(v.title)}</DialogTitle>${
      v.description ? `\n    <DialogDescription>${String(v.description)}</DialogDescription>` : ""
    }
    <DialogFooter>
      <DialogClose render={<Button>Cancel</Button>} />
      <DialogClose render={<Button variant="primary">Confirm</Button>} />
    </DialogFooter>
  </DialogContent>
</Dialog>`,
};

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="flex w-60 flex-col gap-2 rounded-xl bg-raised p-4 shadow-float">
    <p className="font-semibold">Delete project?</p>
    <p className="text-sm text-fg-muted">This cannot be undone.</p>
    <div className="flex justify-end gap-2">
      <Button size="sm">Cancel</Button>
      <Button size="sm" variant="danger">
        Delete
      </Button>
    </div>
  </div>
);
