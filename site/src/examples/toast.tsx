import { Button } from "../../../src/components/button";
import { toast } from "../../../src/components/toast";
import type { Example } from "./types";

export const examples: Example[] = [
  {
    title: "Tones",
    description: "Hover the stack to fan it out. Alt+T focuses it.",
    render: () => (
      <>
        <Button onClick={() => toast.add({ title: "Settings saved" })}>Neutral</Button>
        <Button
          variant="primary"
          onClick={() =>
            toast.add({ tone: "success", title: "Deployed", description: "my-app is live." })
          }
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
