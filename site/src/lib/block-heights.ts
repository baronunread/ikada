/**
 * The rendered height (px) of each block's live preview, [desktop >= 900px, narrow], measured in Chrome with the sample
 * data. The preview is client-only, so its box reserves this much before it hydrates: no layout shift when it appears.
 * Re-measure when a block's layout changes: open /blocks/<slug> at 1440 and 390 and read `.bview .inner`.
 */
export const BLOCK_HEIGHTS: Record<string, [number, number]> = {
  "d1-console": [538, 583],
  "empty-states": [861, 1689],
  "kv-browser": [1325, 1441],
  "logs-panel": [628, 754],
  "metric-row": [304, 344],
  "project-tray": [833, 1214],
  "settings-section": [1255, 1449],
  "sign-in-card": [530, 530],
  "toast-deck": [400, 716],
  "traffic-chart": [436, 476],
  "usage-line": [74, 134],
};
export const blockHeightStyle = (slug: string): string => {
  const [d, m] = BLOCK_HEIGHTS[slug] ?? [192, 192];
  return `--bh:${d}px;--bhm:${m}px`;
};
