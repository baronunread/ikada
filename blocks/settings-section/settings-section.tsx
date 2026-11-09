/**
 * Settings as titled cards: fields, switches that read as sentences, a choice of retention, a save
 * bar that floats up once something changed, and a danger zone that confirms a delete in place.
 */
import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Button } from "../../src/components/button";
import { Field } from "../../src/components/field";
import { InlineConfirm } from "../../src/components/inline-confirm";
import { Input } from "../../src/components/input";
import { RadioGroup } from "../../src/components/radio-group";
import { Select } from "../../src/components/select";
import { Switch } from "../../src/components/switch";
import { cn } from "../../src/lib/cn";

export interface ProjectSettings {
  name: string;
  slug: string;
  region: string;
  notifyFailedDeploys: boolean;
  weeklySummary: boolean;
  retentionDays: string;
}

export interface SettingsSectionProps {
  defaultValues?: ProjectSettings;
  regions?: { value: string; label: string }[];
  /** Persist the changes. Return a promise to keep Save busy until it settles; throw to keep the form dirty. */
  onSave?: (values: ProjectSettings) => void | Promise<void>;
  /** Called once the name has been typed and Delete pressed. */
  onDelete?: (slug: string) => void;
  className?: string;
}

/** Sample data: a small project on the free plan. */
export const sampleSettings: ProjectSettings = {
  name: "Field notes",
  slug: "field-notes",
  region: "eu-central",
  notifyFailedDeploys: true,
  weeklySummary: false,
  retentionDays: "3",
};

export const sampleRegions = [
  { value: "eu-central", label: "Frankfurt (eu-central)" },
  { value: "eu-west", label: "Amsterdam (eu-west)" },
  { value: "us-east", label: "Virginia (us-east)" },
];

const RETENTION = [
  { value: "1", label: "1 day", description: "Enough for a live tail and today's errors." },
  { value: "3", label: "3 days", description: "The free plan's limit." },
  { value: "14", label: "14 days", description: "On paid plans.", disabled: true },
];

/** A titled card; the heading names the section for screen readers. */
function Section({
  id,
  title,
  description,
  action,
  tone,
  children,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  tone?: "danger";
  children?: ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className={cn(
        "flex min-w-0 flex-col gap-4 rounded-xl bg-surface p-4 shadow-card @lg:p-5",
        tone === "danger" && "shadow-[0_0_0_1px_var(--sb-danger-soft),var(--sb-shadow-card)]",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1 basis-60">
          <h2
            id={`${id}-title`}
            className={cn("text-sb-md font-semibold [overflow-wrap:anywhere]", tone === "danger" && "text-danger-fg")}
          >
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-sb-base text-fg-muted [overflow-wrap:anywhere]">{description}</p>
          ) : null}
        </div>
        {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

/** A setting that reads as a sentence, with its switch at the end of the line. */
function SwitchRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <span className="min-w-0">
        <span className="block font-medium [overflow-wrap:anywhere]">{label}</span>
        <span className="block text-sb-sm text-fg-muted [overflow-wrap:anywhere]">{description}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} className="mt-0.5" />
    </label>
  );
}

function DangerZone({ slug, onDelete }: { slug: string; onDelete?: (slug: string) => void }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleted, setDeleted] = useState(false);
  const matches = typed.trim() === slug;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!matches) return;
    onDelete?.(slug);
    setDeleted(true);
  }

  if (deleted) {
    return (
      <Section id="settings-danger" tone="danger" title="Delete project" description={`${slug} was deleted.`}>
        <div>
          <Button size="sm" variant="ghost" onClick={() => (setDeleted(false), setOpen(false), setTyped(""))}>
            Reset the sample
          </Button>
        </div>
      </Section>
    );
  }

  return (
    <Section
      id="settings-danger"
      tone="danger"
      title="Delete project"
      description="Removes every sprout in it, their versions, logs and domains. Storage bound to them is kept."
      action={
        open ? null : (
          <Button variant="danger" onClick={() => setOpen(true)}>
            Delete project
          </Button>
        )
      }
    >
      {open ? (
        <form onSubmit={submit} noValidate className="flex flex-col gap-3 rounded-lg bg-danger-soft/50 p-3 @lg:p-4">
          <Field label={`Type ${slug} to confirm`} description="This cannot be undone.">
            <Input
              mono
              autoFocus
              autoComplete="off"
              spellCheck={false}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
            />
          </Field>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => (setOpen(false), setTyped(""))}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" disabled={!matches}>
              Delete {slug}
            </Button>
          </div>
        </form>
      ) : null}
    </Section>
  );
}

export function SettingsSection({
  defaultValues = sampleSettings,
  regions = sampleRegions,
  onSave,
  onDelete,
  className,
}: SettingsSectionProps) {
  const [saved, setSaved] = useState(defaultValues);
  const [values, setValues] = useState(defaultValues);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof ProjectSettings>(key: K, value: ProjectSettings[K]) =>
    setValues((v) => ({ ...v, [key]: value }));
  const dirty = (Object.keys(values) as (keyof ProjectSettings)[]).some((k) => values[k] !== saved[k]);
  const nameError = values.name.trim() ? undefined : "A project needs a name.";

  async function save(confirm: () => void) {
    if (!dirty || nameError) return;
    setSaving(true);
    setError(null);
    try {
      await onSave?.(values);
      setSaved(values);
      confirm();
    } catch {
      setError("Could not save. Try again in a moment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={cn("@container flex flex-col gap-4 text-fg", className)}>
      <Section id="settings-general" title="General" description="The name is shown in the dashboard and in emails.">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 @xl:grid-cols-[repeat(2,minmax(0,1fr))]">
          <Field label="Name" error={nameError}>
            <Input value={values.name} onChange={(event) => set("name", event.target.value)} autoComplete="off" />
          </Field>
          <Field label="URL name" description="Part of every sprout's hostname, so it cannot change.">
            <Input value={values.slug} mono readOnly disabled />
          </Field>
          <Field label="Region" description="New sprouts run here.">
            <Select
              value={values.region}
              options={regions}
              onValueChange={(next) => typeof next === "string" && set("region", next)}
            />
          </Field>
        </div>
      </Section>

      <Section id="settings-notify" title="Notifications" description="Sent to every member who has not opted out.">
        <div className="flex flex-col divide-y divide-hairline">
          <SwitchRow
            label="Email when a deploy fails"
            description="With the build log's last lines and a link to retry."
            checked={values.notifyFailedDeploys}
            onCheckedChange={(checked) => set("notifyFailedDeploys", checked)}
          />
          <SwitchRow
            label="Weekly usage summary"
            description="Requests, CPU time and storage, every Monday."
            checked={values.weeklySummary}
            onCheckedChange={(checked) => set("weeklySummary", checked)}
          />
        </div>
      </Section>

      <Section
        id="settings-logs"
        title="Log retention"
        description="How long request and console logs stay searchable."
      >
        <RadioGroup
          aria-label="Keep logs for"
          options={RETENTION}
          value={values.retentionDays}
          onValueChange={(next) => typeof next === "string" && set("retentionDays", next)}
        />
      </Section>

      {/* The save bar keeps its place so nothing jumps; once something changed it sticks to the bottom and floats up. */}
      <div
        data-dirty={dirty ? "" : undefined}
        className={cn(
          "bottom-3 z-(--sb-z-sticky) flex flex-wrap items-center data-dirty:sticky gap-x-3 gap-y-2 rounded-xl px-4 py-2.5",
          "[transition:background-color_var(--sb-duration-hover)_var(--ease-hover),box-shadow_var(--sb-duration-hover)_var(--ease-hover),translate_var(--sb-duration-spring-snappy)_var(--sb-spring-snappy)]",
          "bg-well shadow-tray",
          "data-dirty:-translate-y-(--sb-offset-press) data-dirty:bg-raised data-dirty:shadow-float",
        )}
      >
        <p className="me-auto text-sb-sm text-fg-muted" aria-live="polite">
          {error ? (
            <span className="text-danger-fg">{error}</span>
          ) : dirty ? (
            "You have unsaved changes."
          ) : (
            "Everything is saved."
          )}
        </p>
        <div className="ms-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={!dirty || saving}
            onClick={() => (setValues(saved), setError(null))}
          >
            Discard
          </Button>
          <InlineConfirm message="Saved">
            {({ confirm }) => (
              <Button
                size="sm"
                variant="primary"
                disabled={!dirty || Boolean(nameError)}
                loading={saving}
                onClick={() => void save(confirm)}
              >
                Save changes
              </Button>
            )}
          </InlineConfirm>
        </div>
      </div>

      <DangerZone slug={values.slug} onDelete={onDelete} />
    </div>
  );
}
