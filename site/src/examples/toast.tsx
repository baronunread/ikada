import { Button } from "../../../src/components/button";
import { toast, type ToastTone } from "../../../src/components/toast";
import type { Example, Playground, Preview } from "./types";
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
          onClick={() => toast.add({ tone: "success", title: "Deployed", description: "robin is live." })}
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
    code: `<Button onClick={() => toast.add({ title: "Settings saved" })}>Neutral</Button>
<Button
  variant="primary"
  onClick={() => toast.add({ tone: "success", title: "Deployed", description: "robin is live." })}
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
</Button>`,
  },
  {
    title: "Actions",
    description: "A ghost action is plain underlined text; a danger one is a red button.",
    render: () => (
      <Button
        onClick={() =>
          toast.add({
            tone: "danger",
            title: "Deploy failed",
            description: "wren: build exited with 1.",
            actions: [
              { label: "View build log", onClick: ({ close }) => close() },
              { label: "Retry", variant: "danger", onClick: ({ close }) => close() },
            ],
          })
        }
      >
        With actions
      </Button>
    ),
    code: `<Button
  onClick={() =>
    toast.add({
      tone: "danger",
      title: "Deploy failed",
      description: "wren: build exited with 1.",
      actions: [
        { label: "View build log", onClick: ({ close }) => close() },
        { label: "Retry", variant: "danger", onClick: ({ close }) => close() },
      ],
    })
  }
>
  With actions
</Button>`,
  },
  {
    title: "In progress",
    description: "busy spins the glyph and progress draws the line. Update a toast in place by reusing its id.",
    render: () => (
      <Button
        onClick={() => {
          const id = toast.add({
            id: "deploy-finch",
            tone: "info",
            title: "Deploying finch",
            busy: true,
            progress: 0.4,
            duration: 0,
          });
          setTimeout(
            () =>
              toast.update(id, {
                tone: "success",
                title: "finch is live",
                busy: false,
                progress: null,
                duration: 5000,
              }),
            2500,
          );
        }}
      >
        Deploy finch
      </Button>
    ),
    code: `<Button
  onClick={() => {
    const id = toast.add({
      id: "deploy-finch",
      tone: "info",
      title: "Deploying finch",
      busy: true,
      progress: 0.4,
      duration: 0,
    });
    setTimeout(
      () => toast.update(id, { tone: "success", title: "finch is live", busy: false, progress: null, duration: 5000 }),
      2500,
    );
  }}
>
  Deploy finch
</Button>`,
  },
];

const tones = ["info", "success", "warning", "danger", "neutral"] as const;

/** The prop playground at the top of the page: the button fires a toast with the current options. */
export const playground: Playground = {
  component: "toast",
  controls: [
    { prop: "tone", kind: "select", options: tones, default: "info" },
    { prop: "title", kind: "text" },
    { prop: "description", kind: "text", default: "" },
    { prop: "busy", kind: "boolean", default: false },
  ],
  initial: { tone: "success", title: "Deployed", description: "robin is live." },
  render: (v) => (
    <Button
      onClick={() =>
        toast.add({
          tone: v.tone as ToastTone,
          title: String(v.title),
          description: v.description ? String(v.description) : undefined,
          busy: Boolean(v.busy),
        })
      }
    >
      Show toast
    </Button>
  ),
  code: (v) => {
    const opts = [
      v.tone !== "info" ? `tone: "${v.tone}"` : "",
      `title: "${v.title}"`,
      v.description ? `description: "${v.description}"` : "",
      v.busy ? "busy: true" : "",
    ].filter(Boolean);
    return `<Button onClick={() => toast.add({ ${opts.join(", ")} })}>Show toast</Button>`;
  },
};

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
