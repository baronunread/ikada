// Protection-mask constants shared by both backends (aspect-corrected units: canvas height = 1).
/** Gaussian fade width outside each zone: the field returns to full strength over about this distance
 *  (scaled down on narrow canvases: × min(1, aspect × 0.85), so a phone keeps some field). */
export const MASK_FEATHER = 0.2;
/** Corner radius of the zones, clamped to the half-size: in practice every zone is a capsule. */
export const MASK_RADIUS = 0.5;
