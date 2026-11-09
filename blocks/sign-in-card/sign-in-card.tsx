/**
 * One card for getting in: email a sign-in link or continue with GitHub, then a check-your-inbox
 * state; in waitlist mode, a short join form whose confirmation sprouts.
 */
import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Button } from "../../src/components/button";
import { Field } from "../../src/components/field";
import { Input } from "../../src/components/input";
import { Select } from "../../src/components/select";
import { StatusGlyph } from "../../src/components/status-glyph";
import { Textarea } from "../../src/components/textarea";
import { cn, focusRing } from "../../src/lib/cn";
import { GitHubIcon, MailIcon } from "../../src/lib/icons";

export type SignInMode = "sign-in" | "waitlist";

export interface WaitlistEntry {
  email: string;
  useCase: string;
  note?: string;
}

export interface SignInCardProps {
  /** Controlled mode. Leave unset to let the card's own links switch between sign-in and waitlist. */
  mode?: SignInMode;
  defaultMode?: SignInMode;
  onModeChange?: (mode: SignInMode) => void;
  /** The product's mark and name, at the top of the card. */
  brand?: ReactNode;
  /** Short line under the heading in sign-in mode. */
  note?: string;
  /** Send the sign-in link. Throw to show an error under the field. */
  onSendLink?: (email: string) => void | Promise<void>;
  onGitHub?: () => void;
  /** Save the waitlist entry. Throw to show an error. */
  onJoinWaitlist?: (entry: WaitlistEntry) => void | Promise<void>;
  useCases?: { value: string; label: string }[];
  className?: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Sample data: what people say they will build. */
export const sampleUseCases = [
  { value: "side-project", label: "A side project" },
  { value: "startup", label: "A startup's product" },
  { value: "work", label: "Something at work" },
  { value: "learning", label: "Learning and trying things" },
];

/** A sample backend: answers after a short wait, like a real request. */
const wait = () => new Promise<void>((resolve) => setTimeout(resolve, 700));

function SproutMark() {
  return (
    <svg viewBox="3 6 24 25" className="size-6 shrink-0 text-brand-dot" fill="none" aria-hidden="true">
      <path d="M16 29V15" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <path
        d="M16 16.5c0-4.7-3.8-8.5-8.5-8.5C6.7 8 6 8.7 6 9.5 6 14.2 9.8 18 14.5 18c.8 0 1.5-.7 1.5-1.5Z"
        fill="currentColor"
      />
      <path
        d="M16 15c0-4 3.2-7.2 7.2-7.2.7 0 1.3.6 1.3 1.3C24.5 12.8 21.3 16 17.3 16c-.7 0-1.3-.6-1.3-1Z"
        fill="currentColor"
        fillOpacity="0.72"
      />
    </svg>
  );
}

const sampleBrand = (
  <span className="inline-flex items-center gap-2 text-sb-md font-bold">
    <SproutMark />
    Sproutboat
  </span>
);

/** An inline text button that switches modes, styled as a link. */
function SwitchLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("rounded-sm font-semibold text-fg underline underline-offset-2 hover:text-brand-fg", focusRing)}
    >
      {children}
    </button>
  );
}

function SignIn({
  note,
  onSendLink,
  onGitHub,
  toWaitlist,
}: {
  note: string;
  onSendLink: (email: string) => void | Promise<void>;
  onGitHub?: () => void;
  toWaitlist: () => void;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!EMAIL.test(email.trim())) {
      setError("Enter the email address you were invited with.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      await onSendLink(email.trim());
      setSent(true);
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : "The link did not send. Try again.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-5" role="status">
        <span
          className="grid size-10 place-items-center rounded-lg bg-well text-fg-muted shadow-tray"
          aria-hidden="true"
        >
          <MailIcon className="size-5" />
        </span>
        <div className="flex flex-col gap-2">
          <h2 className="text-sb-xl font-bold">Check your inbox</h2>
          <p className="text-sb-base text-fg-muted">
            A sign-in link is on its way to <span className="font-semibold break-all text-fg">{email.trim()}</span>. It
            works once and expires in 15 minutes.
          </p>
        </div>
        <Button variant="ghost" onClick={() => setSent(false)}>
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-sb-xl font-bold">Sign in</h2>
        <p className="text-sb-base text-fg-muted">{note}</p>
      </div>
      <div className="flex flex-col gap-3">
        <Field label="Email" error={error ?? undefined}>
          <Input
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </Field>
        <Button type="submit" variant="primary" loading={sending}>
          Email me a sign-in link
        </Button>
      </div>
      <div className="flex items-center gap-3 text-sb-sm text-fg-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-hairline" />
        or
        <span className="h-px flex-1 bg-hairline" />
      </div>
      <Button type="button" variant="secondary" onClick={onGitHub}>
        <GitHubIcon />
        Continue with GitHub
      </Button>
      <p className="text-center text-sb-sm text-fg-muted">
        No invite yet? <SwitchLink onClick={toWaitlist}>Join the waitlist</SwitchLink>
      </p>
    </form>
  );
}

function Waitlist({
  useCases,
  onJoin,
  toSignIn,
}: {
  useCases: { value: string; label: string }[];
  onJoin: (entry: WaitlistEntry) => void | Promise<void>;
  toSignIn: () => void;
}) {
  const [email, setEmail] = useState("");
  const [useCase, setUseCase] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<{ email?: string; useCase?: string; form?: string }>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: typeof errors = {};
    if (!EMAIL.test(email.trim())) next.email = "Enter an email address we can write to.";
    if (!useCase) next.useCase = "Pick the closest one.";
    setErrors(next);
    if (next.email || !useCase) return;
    setSaving(true);
    try {
      await onJoin({ email: email.trim(), useCase, note: note.trim() || undefined });
      setDone(email.trim());
    } catch {
      setErrors({ form: "That did not save. Check your connection and try again." });
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4" role="status">
        <span className="grid size-10 place-items-center rounded-full bg-brand-soft" aria-hidden="true">
          <StatusGlyph tone="success" sprout className="size-3.5" />
        </span>
        <h2 className="text-sb-xl font-bold">You are on the list</h2>
        <p className="text-sb-base text-fg-muted">
          We let people in a few at a time and will write to{" "}
          <span className="font-semibold break-all text-fg">{done}</span> when your spot opens. Nothing else.
        </p>
        <p className="text-sb-sm text-fg-muted">
          Invited after all? <SwitchLink onClick={toSignIn}>Sign in</SwitchLink>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-sb-xl font-bold">Join the waitlist</h2>
        <p className="text-sb-base text-fg-muted">Tell us a little, and we will invite you when a spot opens.</p>
      </div>
      <Field label="Email" error={errors.email}>
        <Input
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
        />
      </Field>
      <Field label="What will you build?" error={errors.useCase}>
        <Select
          value={useCase}
          placeholder="Choose one"
          options={useCases}
          invalid={Boolean(errors.useCase)}
          onValueChange={(value) => setUseCase(typeof value === "string" ? value : null)}
        />
      </Field>
      <Field label="Anything we should know?" description="Optional. Your framework, or what you are missing today.">
        <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={500} />
      </Field>
      {errors.form ? <p className="text-sb-sm text-danger-fg">{errors.form}</p> : null}
      <Button type="submit" variant="primary" loading={saving}>
        Join the waitlist
      </Button>
      <p className="text-center text-sb-sm text-fg-muted">
        Already invited? <SwitchLink onClick={toSignIn}>Sign in</SwitchLink>
      </p>
    </form>
  );
}

export function SignInCard({
  mode: controlled,
  defaultMode = "sign-in",
  onModeChange,
  brand = sampleBrand,
  note = "Invite-only while we are in alpha.",
  onSendLink = wait,
  onGitHub,
  onJoinWaitlist = wait,
  useCases = sampleUseCases,
  className,
}: SignInCardProps) {
  const [own, setOwn] = useState<SignInMode>(defaultMode);
  const mode = controlled ?? own;
  const go = (next: SignInMode) => {
    setOwn(next);
    onModeChange?.(next);
  };
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-sm flex-col gap-6 rounded-xl bg-surface p-6 text-fg shadow-card",
        className,
      )}
    >
      {brand ? <div>{brand}</div> : null}
      {mode === "sign-in" ? (
        <SignIn note={note} onSendLink={onSendLink} onGitHub={onGitHub} toWaitlist={() => go("waitlist")} />
      ) : (
        <Waitlist useCases={useCases} onJoin={onJoinWaitlist} toSignIn={() => go("sign-in")} />
      )}
    </div>
  );
}
