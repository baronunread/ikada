/**
 * Directory metadata for every registry item: categories on all of them, a `docs` message where
 * installing needs a setup step, and titles and descriptions where the source's JSDoc line is
 * too thin to read in a list. The build fails when an item has no category.
 */

export const CATEGORIES: Record<string, string[]> = {
  theme: ["theme"],
  all: ["bundle"],
  // Actions and forms
  button: ["actions"],
  "icon-button": ["actions"],
  link: ["actions", "navigation"],
  checkbox: ["forms"],
  field: ["forms"],
  input: ["forms"],
  textarea: ["forms"],
  label: ["forms"],
  "radio-group": ["forms"],
  select: ["forms"],
  "segmented-control": ["forms"],
  "sensitive-input": ["forms"],
  switch: ["forms"],
  // Navigation
  breadcrumbs: ["navigation"],
  "command-palette": ["navigation", "overlays"],
  "page-header": ["navigation", "layout"],
  pagination: ["navigation"],
  sidebar: ["navigation", "layout"],
  tabs: ["navigation"],
  // Overlays
  dialog: ["overlays"],
  "dropdown-menu": ["overlays"],
  popover: ["overlays"],
  tooltip: ["overlays"],
  // Feedback
  banner: ["feedback"],
  "inline-confirm": ["feedback"],
  meter: ["feedback", "data-display"],
  skeleton: ["feedback"],
  spinner: ["feedback"],
  toast: ["feedback"],
  "toast-api": ["feedback", "utilities"],
  // Data display
  avatar: ["data-display"],
  badge: ["data-display"],
  "code-block": ["data-display"],
  "copy-id": ["data-display"],
  "description-list": ["data-display"],
  "empty-state": ["feedback", "data-display"],
  kbd: ["data-display"],
  "metric-tile": ["data-display"],
  "status-dot": ["data-display"],
  "status-glyph": ["data-display"],
  status: ["data-display", "utilities"],
  table: ["data-display"],
  // Charts
  sparkline: ["charts"],
  "timeseries-chart": ["charts"],
  "chart-theme": ["charts", "utilities"],
  // Libraries
  cn: ["utilities"],
  "accessible-name": ["utilities"],
  crossfade: ["utilities"],
  format: ["utilities"],
  icons: ["utilities"],
  instant: ["utilities"],
  locale: ["utilities"],
  portal: ["utilities"],
  spring: ["utilities"],
  tokens: ["utilities", "theme"],
};

/** Text that replaces the JSDoc-derived title or description. */
export const TEXT: Record<string, { title?: string; description?: string }> = {
  theme: {
    title: "ikada theme",
    description:
      "ikada's tokens for Tailwind v4: OKLCH colours for light and dark, an ikada-scoped type scale (text-sb-*), radii, shadows, motion springs, layers and density. Light by default, dark with a .dark class.",
  },
  all: {
    title: "All ikada components",
    description: "Every ikada component, its helpers and the theme, installed under components/ikada.",
  },
  breadcrumbs: {
    description: "A breadcrumb trail for the org, project and environment you are in, collapsing on narrow screens.",
  },
  checkbox: {
    description: "A yes/no choice for forms, with a checked, unchecked and indeterminate state and a springy tick.",
  },
  "command-palette": {
    description: "Global search and jump on Cmd or Ctrl K: grouped results, prefix filters and keyboard navigation.",
  },
  dialog: {
    description:
      "A modal dialog with title, description and actions; a click opens it with a spring, a key press opens it instantly.",
  },
  "page-header": {
    description: "The title row of a page: breadcrumbs, title, status, actions and optional page tabs.",
  },
  sidebar: {
    description:
      "The account navigation: a collapsible rail on desktop and a drawer on mobile, with grouped items and a footer.",
  },
  label: { description: "A form label that pairs with Input, Select and the other controls, with a required marker." },
  link: {
    description:
      "An inline link with an underline that follows the text colour; renders any element through the render prop.",
  },
  spinner: { description: "A turning ring for pending work, in three sizes; it stays still under reduced motion." },
  kbd: { description: "A keycap for shortcut hints, such as the K in Cmd K." },
  meter: {
    description: "A labelled bar for a bounded measurement, with normal, warning and danger tones and a usage variant.",
  },
  status: {
    title: "Status",
    description:
      "The status vocabulary (live, building, failed, paused and others) shared by Badge, StatusDot and Toast.",
  },
  "toast-api": {
    title: "Toast API",
    description:
      "The toast store behind the toast component: toast(), success and error helpers, undo, merging repeats and mutable deploy toasts.",
  },
  cn: {
    title: "cn and style primitives",
    description:
      "ikada's class helper (clsx plus tailwind-merge that understands the text-sb-* sizes) and the shared style primitives: focus ring, press motion, popup motion and field surfaces. Installs to components/ikada/lib, never to lib/utils.",
  },
  "icon-button": {
    description: "A Button that shows only an icon, with a required accessible label and a tooltip-ready target.",
  },
  "radio-group": {
    description: "One choice out of a few, all visible at once, with keyboard arrows and a springy dot.",
  },
  switch: {
    description: "An on/off setting that applies at once, with a label slot and a thumb that settles on a spring.",
  },
  table: {
    description: "A semantic table in a scroll container, with sortable headers, loading, empty and error rows.",
  },
  "accessible-name": {
    title: "Accessible name",
    description: "The aria-label or deprecated ariaLabel prop type that the chart components share.",
  },
  format: {
    description: "Number and byte formatting shared by every ikada component: compact, grouped and locale-aware.",
  },
  tokens: {
    title: "Design tokens",
    description:
      "ikada's design tokens as typed data: colours, type, spacing, radii, shadows, motion, springs and layers.",
  },
  portal: { description: "Where floating layers mount, so menus and dialogs can sit inside a themed container." },
  "chart-theme": {
    title: "Chart theme",
    description: "Chart colour tokens as CSS variable references, so TanStack Charts follow light and dark.",
  },
};

/** Setup that installing an item does not do by itself, shown by the CLI after it installs. */
export const DOCS: Record<string, string> = {
  theme:
    'Light is the default; add class="dark" to <html> for dark (next-themes: attribute="class"). Load Figtree and JetBrains Mono if you want ikada\'s faces (otherwise the system faces are used). ikada never redefines Tailwind\'s text-* scale: its sizes are text-sb-*.',
  all: 'Components install to components/ikada/ and never overwrite your own button.tsx, input.tsx and the rest. Import them from "@/components/ikada/<name>". Add class="dark" to <html> for dark mode.',
  toast:
    "Mount <ToastProvider> once near the root of your app (and <TooltipProvider> for tooltips), then call toast() from anywhere.",
  "toast-api": "Mount <ToastProvider> from the toast item once near the root; toast() works from anywhere after that.",
  tooltip: "Wrap your app (or the part that uses tooltips) in <TooltipProvider> once.",
  "timeseries-chart":
    "Uses @tanstack/charts (installed with this item). Load it lazily in routes that show charts, for example with React.lazy or next/dynamic.",
  sparkline: "Uses @tanstack/charts (installed with this item). Load it lazily where the chart is below the fold.",
  "command-palette": "Mount it once in your layout and open it with useCommandPaletteShortcut().",
  sidebar: "Wrap the app shell in the sidebar's state hook as shown in the docs; on mobile it becomes a drawer.",
};
