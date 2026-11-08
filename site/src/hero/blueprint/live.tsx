import { useState } from "react";
import type { ReactNode } from "react";
import {
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
  Select,
  Switch,
  Tabs,
  TabsList,
  TabsPanel,
  TabsTab,
  Tooltip,
  toast,
} from "../../../../src";

import type { PartId } from "./meta";
const regions = [
  { value: "fra", label: "Frankfurt · fra" },
  { value: "iad", label: "Ashburn · iad" },
  { value: "sin", label: "Singapore · sin" },
];

export function Live({ id }: { id: PartId }): ReactNode {
  switch (id) {
    case "sprout":
      return <ButtonDemo />;
    case "boards":
      return (
        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTab value="overview">Overview</TabsTab>
            <TabsTab value="logs">Logs</TabsTab>
            <TabsTab value="settings">Settings</TabsTab>
          </TabsList>
          <TabsPanel value="overview" className="text-sm text-fg-muted">
            1.28 MiB asleep, wakes in 6 ms.
          </TabsPanel>
          <TabsPanel value="logs" className="font-mono text-xs text-fg-muted">
            GET /feed 200 · 7 ms
          </TabsPanel>
          <TabsPanel value="settings" className="text-sm text-fg-muted">
            Region, secrets, domains.
          </TabsPanel>
        </Tabs>
      );
    case "lashings":
      return (
        <div className="flex flex-col gap-3">
          <Switch label="Wake on request" defaultChecked />
          <Switch label="Scale to zero when idle" />
        </div>
      );
    case "logA":
      return <SelectDemo />;
    case "logB":
      return (
        <Dialog>
          <DialogTrigger render={<Button variant="secondary">Delete app…</Button>} />
          <DialogContent>
            <DialogTitle>Delete feed-199?</DialogTitle>
            <DialogDescription>
              Its route, secrets and logs are removed. Deployed code stays in your repo.
            </DialogDescription>
            <DialogFooter>
              <DialogClose render={<Button variant="ghost">Cancel</Button>} />
              <DialogClose render={<Button variant="danger">Delete app</Button>} />
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    case "cleat":
      return (
        <div className="flex items-center gap-3">
          <Tooltip content="Copy hostname" delay={0} side="bottom">
            <Button size="sm" variant="secondary" className="font-mono text-xs">
              feed-199.northwind
            </Button>
          </Tooltip>
          <Badge tone="success">running</Badge>
        </div>
      );
    case "buoy":
      return (
        <Button
          variant="secondary"
          onClick={() =>
            toast.add({
              title: "Deployed feed-199",
              description: "Live in 6 ms on northwind.sproutboat.app",
              tone: "success",
              duration: 4200,
            })
          }
        >
          Show toast
        </Button>
      );
  }
}

function ButtonDemo(): ReactNode {
  const [s, set] = useState<"idle" | "busy" | "done">("idle");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="primary"
        loading={s === "busy"}
        onClick={() => {
          set("busy");
          setTimeout(() => set("done"), 1300);
          setTimeout(() => set("idle"), 3200);
        }}
      >
        {s === "done" ? "Deployed" : "Deploy"}
      </Button>
      <Button variant="secondary">Cancel</Button>
      <Button variant="ghost">Logs</Button>
    </div>
  );
}
function SelectDemo(): ReactNode {
  const [v, set] = useState<string | null>("fra");
  return <Select options={regions} value={v} onValueChange={set} aria-label="Region" />;
}
