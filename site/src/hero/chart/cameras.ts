// The framing numbers of the `raft` camera, kept apart from the renderer so that a page can place things over the raft
// (the blueprint sheet on /ikada opens from the raft marker) without loading the chart.
/** where the raft sits on screen under the `raft` camera: [landscape, portrait] as fractions of the canvas */
export const RAFT_UV = { land: [0.63, 0.58], port: [0.46, 0.7] } as const;
/** zoom over cover-fit under the `raft` camera: [landscape, portrait] */
export const RAFT_Z = { land: 2.9, port: 1.7 } as const;

const sstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** 0 landscape .. 1 portrait, by aspect (the same blend the chart's cameras use) */
export const portraitWeight = (w: number, h: number): number => sstep(1.12, 0.78, w / h);

/** the raft marker's position on a canvas of w x h CSS px, under the `raft` camera */
export function raftScreenPx(w: number, h: number): { x: number; y: number } {
  const pw = portraitWeight(w, h);
  return {
    x: (RAFT_UV.land[0] + (RAFT_UV.port[0] - RAFT_UV.land[0]) * pw) * w,
    y: (RAFT_UV.land[1] + (RAFT_UV.port[1] - RAFT_UV.land[1]) * pw) * h,
  };
}
/** the raft marker's scale on screen (the chart draws it larger as the zoom grows) */
export function raftMarkerScale(w: number, h: number): number {
  const pw = portraitWeight(w, h);
  const lz = Math.log(RAFT_Z.land) + (Math.log(RAFT_Z.port) - Math.log(RAFT_Z.land)) * pw;
  return 1.28 * (1 + 0.95 * Math.min(1.2, lz / 1.2));
}
