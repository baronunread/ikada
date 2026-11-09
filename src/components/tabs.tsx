import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import type { ComponentProps } from "react";
import { cn, focusRing, pebble, traySurface, type WithClass } from "../lib/cn";

/** Switches between views of one subject in place. Compose with TabsList, TabsTab and TabsPanel. */
export function Tabs({ className, ...props }: WithClass<ComponentProps<typeof BaseTabs.Root>>) {
  return <BaseTabs.Root data-slot="tabs" className={cn("flex flex-col", className)} {...props} />;
}

/**
 * A recessed 10px tray (padding 4) holding 6px tabs. The raised pebble, shared with
 * SegmentedControl, is one element that slides to the active tab on the snappy spring.
 */
export function TabsList({ className, children, ...props }: WithClass<ComponentProps<typeof BaseTabs.List>>) {
  return (
    <BaseTabs.List
      data-slot="tabs-list"
      className={cn(
        "relative inline-flex max-w-full gap-0.5 self-start overflow-x-auto p-1 [scrollbar-width:none]",
        traySurface,
        className,
      )}
      {...props}
    >
      {children}
      <BaseTabs.Indicator
        className={cn(
          pebble,
          "h-(--active-tab-height) w-(--active-tab-width) translate-x-(--active-tab-left) translate-y-(--active-tab-top) rounded-sm",
        )}
      />
    </BaseTabs.List>
  );
}

/** One tab. Its label stays above the pebble. */
export function TabsTab({ className, ...props }: WithClass<ComponentProps<typeof BaseTabs.Tab>>) {
  return (
    <BaseTabs.Tab
      data-slot="tabs-tab"
      className={cn(
        "relative z-10 flex h-8 shrink-0 items-center whitespace-nowrap rounded-sm px-3 text-sb-base font-semibold text-fg-muted",
        "transition-colors duration-(--sb-duration-hover) ease-hover",
        "hover:text-fg data-active:text-fg data-disabled:cursor-not-allowed data-disabled:opacity-50",
        "before:absolute before:inset-x-0 before:top-1/2 before:h-10 before:-translate-y-1/2 before:content-[''] pointer-fine:before:hidden",
        "pointer-coarse:min-h-11",
        focusRing,
        className,
      )}
      {...props}
    />
  );
}

/** The content shown for the matching tab. */
export function TabsPanel({ className, ...props }: WithClass<ComponentProps<typeof BaseTabs.Panel>>) {
  return (
    <BaseTabs.Panel
      data-slot="tabs-panel"
      className={cn(
        "pt-4 outline-hidden focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        className,
      )}
      {...props}
    />
  );
}
