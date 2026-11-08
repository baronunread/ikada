// What each part of the blueprint is: kept apart from the live components so the sheet can label its parts without
// loading them (live.tsx is a lazy chunk, fetched when a part is first opened or when the browser is idle).
export type PartId = "sprout" | "boards" | "lashings" | "logA" | "logB" | "cleat" | "buoy";
export interface PartMeta {
  id: PartId;
  /** the ikada component */
  comp: string;
  /** one line in the chart's italic */
  note: string;
  snippet: string;
}
export const META: Record<PartId, PartMeta> = {
  sprout: {
    id: "sprout",
    comp: "Button",
    note: "the sprout, one per view",
    snippet: '<Button variant="primary">Deploy</Button>',
  },
  boards: {
    id: "boards",
    comp: "Tabs",
    note: "deck boards, side by side",
    snippet: '<Tabs><TabsList><TabsTab value="logs" />…',
  },
  lashings: {
    id: "lashings",
    comp: "Switch",
    note: "lashings, tied or let go",
    snippet: '<Switch label="Wake on request" />',
  },
  logA: {
    id: "logA",
    comp: "Select",
    note: "a log you pick from",
    snippet: '<Select options={regions} aria-label="Region" />',
  },
  logB: {
    id: "logB",
    comp: "Dialog",
    note: "the hull that holds the rest",
    snippet: "<Dialog><DialogTrigger /><DialogContent />",
  },
  cleat: {
    id: "cleat",
    comp: "Tooltip",
    note: "a cleat with a tag",
    snippet: '<Tooltip content="Copy hostname">…</Tooltip>',
  },
  buoy: { id: "buoy", comp: "Toast", note: "the buoy that surfaces", snippet: 'toast.add({ title: "Deployed" })' },
};
