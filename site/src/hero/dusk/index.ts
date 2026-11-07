// Raft at dusk: one scene for sproutboat.com, its docs and the ikada site, each with its own camera.
// The source of truth is ikada's site/src/hero/dusk/; other sites vendor a copy with scripts/sync-dusk.ts.
// README.md in this folder is the contract.
export const DUSK_VERSION = "1.0.0";

export { CAMERAS, freshState, mount } from "./scene";
export type { Backend, Camera, DuskState, Handle, MountOptions, Rect, Stats, Theme } from "./scene";
export { HANDOFF_KEY, HANDOFF_MAX_AGE_MS, HEAD_SCRIPT, POSTER_SCRIPT, saveHandoff, takeHandoff } from "./handoff";
export type { Handoff } from "./handoff";
