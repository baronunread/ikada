import { useState } from "react";
import type { ReactNode } from "react";
import { Button } from "../../../src/components/button";
import { Checkbox } from "../../../src/components/checkbox";
import { SegmentedControl } from "../../../src/components/segmented-control";
import { StatusGlyph } from "../../../src/components/status-glyph";
import { Switch } from "../../../src/components/switch";
import { toast, ToastProvider } from "../../../src/components/toast";

/** The Motion page's live demos: the real components, one Afloat moment each. */
function Cell({
  n,
  title,
  text,
  values,
  children,
}: {
  n: string;
  title: string;
  text: string;
  values: string;
  children: ReactNode;
}) {
  return (
    <li className="flex flex-col overflow-hidden rounded-[14px] bg-surface shadow-card">
      <div className="m-2 grid min-h-36 place-items-center rounded-lg bg-well p-6 shadow-tray">{children}</div>
      <div className="flex flex-col gap-1.5 px-4 pt-2 pb-4">
        <span className="font-mono text-xs text-fg-muted">{n}</span>
        <h3 className="m-0 text-base font-semibold text-fg">{title}</h3>
        <p className="m-0 text-sm text-fg-muted">{text}</p>
        <span className="mt-1 font-mono text-xs text-fg-muted">{values}</span>
      </div>
    </li>
  );
}

export default function MotionDemos() {
  const [range, setRange] = useState("week");
  const [on, setOn] = useState(true);
  const [checked, setChecked] = useState(false);
  const [sprout, setSprout] = useState(0);
  return (
    <ToastProvider>
      <ul className="my-4 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
        <Cell
          n="01"
          title="Takes your weight"
          text="The press settles 1px and 3%; the release returns on a spring that overshoots once."
          values="press 90ms · bob 0.45s, bounce 0.25"
        >
          <Button
            variant="primary"
            onClick={() => toast.add({ tone: "success", title: "Sprout planted", description: "robin · eu-west" })}
          >
            Press and hold
          </Button>
        </Cell>
        <Cell
          n="02"
          title="A pebble on a tray"
          text="One raised indicator slides across a recessed tray."
          values="snappy 0.35s, bounce 0.15"
        >
          <SegmentedControl
            aria-label="Range"
            options={[
              { value: "day", label: "Day" },
              { value: "week", label: "Week" },
              { value: "month", label: "Month" },
            ]}
            value={range}
            onValueChange={setRange}
          />
        </Cell>
        <Cell
          n="03"
          title="Thumb and check"
          text="The switch thumb squishes toward its travel; a checkbox bobs once as it fills."
          values="snappy · bob, on change only"
        >
          <div className="flex flex-col items-start gap-3">
            <Switch label="Wake on request" checked={on} onCheckedChange={setOn} />
            <Checkbox label="Keep logs for 30 days" checked={checked} onCheckedChange={(c) => setChecked(c === true)} />
          </div>
        </Cell>
        <Cell
          n="04"
          title="Success sprouts"
          text="The success glyph grows from its base and sends one ring out. Only success and creation sprout."
          values="sprout 480ms · ring 700ms"
        >
          <div className="flex items-center gap-4">
            <StatusGlyph key={sprout} tone="success" sprout />
            <Button size="sm" onClick={() => setSprout((n) => n + 1)}>
              Replay
            </Button>
          </div>
        </Cell>
      </ul>
    </ToastProvider>
  );
}
