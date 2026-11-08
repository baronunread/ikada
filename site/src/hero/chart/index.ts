// The nautical chart: one deterministic map for sproutboat.com, its docs and the ikada site, each with its own camera
// (wide, raft, corner) on one continuous zoom. The source of truth is ikada's site/src/hero/chart/; other sites vendor
// a copy with scripts/sync-chart.ts. README.md in this folder is the contract.
export const CHART_VERSION = "1.0.0";

export { freshState, mount, T0, WORDS } from "./scene";
export type { Backend, Camera, ChartState, Handle, Mask, MountOptions, Rect, Stats, Theme, Tune, Words } from "./scene";
export { HANDOFF_KEY, HANDOFF_MAX_AGE_MS, HEAD_SCRIPT, POSTER_SCRIPT, saveHandoff, takeHandoff } from "./handoff";
export type { Handoff } from "./handoff";
export { portraitWeight, raftMarkerScale, raftScreenPx, RAFT_UV, RAFT_Z } from "./cameras";
