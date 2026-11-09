"use client";

import { useRender } from "@base-ui/react/use-render";
import type { ComponentProps, ReactNode } from "react";
import { cn, coarseTarget, focusRingInset, type WithClass } from "../lib/cn";

export interface PageHeaderProps extends Omit<ComponentProps<"header">, "title"> {
  /** Usually <Breadcrumbs />. */
  breadcrumbs?: ReactNode;
  /** Page title, rendered as the h1. */
  title: ReactNode;
  /** Next to the title: a StatusDot or Badge. */
  status?: ReactNode;
  /** One muted line under the title: domain, repo, branch. */
  description?: ReactNode;
  /** Buttons, right-aligned; they wrap under the title on narrow screens. */
  actions?: ReactNode;
  /** Usually <PageTabs>. Sits on the header's bottom rule. */
  tabs?: ReactNode;
  /** Heading level of the title. Default `h1`; use a lower level when the header is not the page's own title. */
  headingLevel?: "h1" | "h2" | "h3" | "h4";
}

/** Title row for a page. The title is the page's only `h1` unless `headingLevel` says otherwise. */
export function PageHeader({
  breadcrumbs,
  title,
  status,
  description,
  actions,
  tabs,
  headingLevel: Title = "h1",
  className,
  ref,
  ...props
}: PageHeaderProps) {
  return (
    <header data-slot="page-header" ref={ref} className={cn("flex flex-col gap-4", className)} {...props}>
      {breadcrumbs}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <Title className="min-w-0 break-words text-balance text-sb-xl font-bold">{title}</Title>
            {status}
          </div>
          {description ? <p className="break-words text-pretty text-sb-base text-fg-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {tabs}
    </header>
  );
}

/** Page-level navigation: links with an underline under the current one. Scrolls sideways when narrow. */
export function PageTabs({
  className,
  children,
  label = "Page sections",
  ...props
}: ComponentProps<"nav"> & { label?: string }) {
  return (
    <nav
      data-slot="page-tabs"
      aria-label={label}
      className={cn(
        "-mx-1 overflow-x-auto px-1 shadow-[inset_0_-1px_0_var(--sb-hairline)] [scrollbar-width:none]",
        className,
      )}
      {...props}
    >
      <ul className="flex min-w-max gap-3.5">{children}</ul>
    </nav>
  );
}

export interface PageTabProps extends WithClass<useRender.ComponentProps<"a">> {
  /** Marks the tab as the current page (aria-current and the underline). */
  current?: boolean;
}

/** One tab link. With a router, `render={<RouterLink to="/x" />}`. */
export function PageTab({ current = false, className, ref, render, ...props }: PageTabProps) {
  const tab = useRender({
    defaultTagName: "a",
    render,
    ref,
    props: {
      "aria-current": current ? "page" : undefined,
      className: cn(
        "relative -mb-px inline-flex h-10 items-center whitespace-nowrap rounded-xs px-1.5 text-sb-base font-medium text-fg-muted",
        "transition-colors duration-(--sb-duration-hover) ease-hover hover:text-fg aria-[current=page]:text-fg",
        "after:absolute after:inset-x-1.5 after:bottom-0 after:h-0.5 after:rounded-full after:bg-fg after:opacity-0 after:transition-opacity after:duration-(--sb-duration-hover) aria-[current=page]:after:opacity-100",
        coarseTarget,
        // Inset ring: the nav scrolls sideways, so an outer ring would be clipped top and bottom.
        focusRingInset,
        className,
      ),
      ...props,
    },
  });
  return <li data-slot="page-tab">{tab}</li>;
}
