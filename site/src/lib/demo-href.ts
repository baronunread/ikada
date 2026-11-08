/**
 * Where a sample link inside a live demo points: a real page of this site, under the base path.
 * The code a demo shows keeps neutral app paths ("/logs"); only what renders here is retargeted,
 * so a click lands on the page that matches the sample ("Logs" → the Logs panel block).
 * No node imports: demos hydrate in the browser.
 */
const base = import.meta.env.BASE_URL.replace(/\/$/, "");

export const demoHref = (path: string): string => `${base}${path}`;

/** The pages the samples point at. */
export const demo = {
  home: demoHref("/"),
  docs: demoHref("/docs"),
  installation: demoHref("/installation"),
  projects: demoHref("/blocks/project-tray"),
  logs: demoHref("/blocks/logs-panel"),
  settings: demoHref("/blocks/settings-section"),
  metrics: demoHref("/blocks/metric-row"),
  traffic: demoHref("/blocks/traffic-chart"),
  usage: demoHref("/components/meter"),
  deployments: demoHref("/components/table"),
} as const;
