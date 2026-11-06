/**
 * The hero field's loader: WebGPU (TypeGPU) → WebGL2 → the CSS gradient. Each backend is its own
 * chunk, fetched only when picked. Never throws: any failure resolves to the CSS handle.
 * The backends and common.ts are the mockup's files verbatim (scripts/sync-hero-field.ts).
 */
import { cssHandle } from "./common";
import type { Backend, Handle, Opts } from "./common";

export type { Backend, Handle, MaskRect, Opts, Theme } from "./common";

type Mount = (canvas: HTMLCanvasElement, opts: Opts) => Promise<Handle | null>;

async function attempt(
  load: () => Promise<{ mount: Mount }>,
  canvas: HTMLCanvasElement,
  opts: Opts,
): Promise<Handle | null> {
  try {
    return await (await load()).mount(canvas, opts);
  } catch (e) {
    console.warn("[hero-field] backend unavailable, falling back", e);
    return null;
  }
}

export async function mountHeroField(canvas: HTMLCanvasElement, opts: Opts): Promise<Handle> {
  const forced: Backend | undefined = opts.backend;
  if (forced === "css") return cssHandle();
  if (forced !== "webgl2") {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
    const adapter = gpu ? await gpu.requestAdapter().catch(() => null) : null;
    if (adapter) {
      const h = await attempt(() => import("./hero-webgpu"), canvas, opts);
      if (h) return h;
    }
  }
  if (forced !== "webgpu") {
    const h = await attempt(() => import("./hero-webgl"), canvas, opts);
    if (h) return h;
  }
  return cssHandle();
}
