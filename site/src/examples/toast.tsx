import { Button } from "../../../src/components/button";
import { toast } from "../../../src/components/toast";
import type { Example, Preview } from "./types";
import { StatusGlyph } from "../../../src/components/status-glyph";

export const examples: Example[] = [
  {
    title: "Tones",
    description: "Hover the stack to fan it out. Alt+T focuses it.",
    render: () => (
      <>
        <Button onClick={() => toast.add({ title: "Settings saved" })}>Neutral</Button>
        <Button
          variant="primary"
          onClick={() => toast.add({ tone: "success", title: "Deployed", description: "my-app is live." })}
        >
          Success
        </Button>
        <Button
          variant="danger"
          onClick={() =>
            toast.add({
              tone: "danger",
              title: "Deploy failed",
              description: "Build exited with 1.",
            })
          }
        >
          Danger
        </Button>
      </>
    ),
  },
];

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="flex w-60 items-start gap-2.5 rounded-xl bg-raised p-3 text-sm shadow-float">
    <StatusGlyph status="success" className="mt-0.5" />
    <div>
      <p className="font-semibold">Deployed</p>
      <p className="text-fg-muted">my-app is live.</p>
    </div>
  </div>
);
