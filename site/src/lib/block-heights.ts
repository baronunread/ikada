/**
 * The rendered height (px) of each block's live preview, [desktop >= 900px, narrow], measured in Chrome with the sample
 * data. The preview is client-only, so its box reserves this much before it hydrates: no layout shift when it appears.
 * Re-measure when a block's layout changes: open /blocks/<slug> at 1440 and 390 and read `.bview .inner`.
 */
export const BLOCK_HEIGHTS: Record<string, [number, number]> = {
  "d1-console": [583, 583],
  "empty-states": [638, 1246],
  "kv-browser": [1296, 1412],
  "logs-panel": [568, 686],
  "metric-row": [312, 352],
  "project-tray": [671, 1052],
  "settings-section": [953, 1127],
  "sign-in-card": [442, 442],
  "toast-deck": [420, 512],
  "traffic-chart": [348, 388],
  "usage-line": [104, 134],
};
export const blockHeightStyle = (slug: string): string => {
  const [d, m] = BLOCK_HEIGHTS[slug] ?? [192, 192];
  return `--bh:${d}px;--bhm:${m}px`;
};
