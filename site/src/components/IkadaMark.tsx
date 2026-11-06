/**
 * The ikada mark, E4 "Buoyed": a three-quarter raft of two lashed logs sitting low on one wave line.
 * Site-only. The library has no brand export (the dashboards carry the Sproutboat mark), so this
 * stays out of src/ and out of the shadcn registry. Draws in currentColor, the rope at about 45%.
 *
 * Two drawings, each hinted to whole pixels: the 16-grid one at 16 px and below (static), the
 * 24-grid one above that, which carries the motion. Motion lives in ./ikada-mark-motion.ts and the
 * `.ikm` rules in site.css.
 */
import { useEffect, useId, useImperativeHandle, useRef, type ComponentProps, type Ref } from "react";
import { mount, wire, type IkadaMarkMotion } from "./ikada-mark-motion";
import { G16, G24 } from "./ikada-mark-paths";

export interface IkadaMarkHandle {
  /** Start or stop the loading loop. Starts after `delay` ms (400 by default). */
  loading(on: boolean, options?: { delay?: number }): void;
  /** Play the success rise and ring once. Ends a loading loop with a quick hand-off. */
  success(): void;
}

export interface IkadaMarkProps extends Omit<
  ComponentProps<"svg">,
  "width" | "height" | "viewBox" | "children" | "ref"
> {
  /** Width and height in px, or any CSS length. Numbers up to 16 use the 16-grid drawing. */
  size?: number | string;
  /** Accessible name. Without it the mark is decorative and hidden from assistive tech. */
  title?: string;
  /**
   * "interactive": hover and press on the enclosing link or button, and the first-paint drop once
   * per session. "none": still. Either way `loading` and `success` play when asked.
   */
  motion?: "none" | "interactive";
  /** Show the loading loop (after `loadingDelay` ms, so short loads never flash it). */
  loading?: boolean;
  loadingDelay?: number;
  /** Plays the success moment each time this turns true. */
  success?: boolean;
  ref?: Ref<IkadaMarkHandle>;
}

export function IkadaMark({
  size = 24,
  title,
  motion = "interactive",
  loading = false,
  loadingDelay = 400,
  success = false,
  ref,
  className,
  ...props
}: IkadaMarkProps) {
  const id = useId().replace(/[^\w-]/g, "");
  const small = typeof size === "number" && size <= 16;
  const svg = useRef<SVGSVGElement>(null);
  const api = useRef<IkadaMarkMotion | null>(null);
  const wasSuccess = useRef(success);

  useEffect(() => {
    const el = svg.current;
    const motionApi = el && !small ? mount(el) : null;
    api.current = motionApi;
    const host = el?.closest<HTMLElement>("a, button");
    const unwire = motionApi && host && motion === "interactive" ? wire(host, motionApi) : undefined;
    return () => {
      unwire?.();
      motionApi?.dispose();
    };
  }, [small, motion]);

  useEffect(() => {
    api.current?.loading(loading, { delay: loadingDelay });
  }, [loading, loadingDelay, small, motion]);

  useEffect(() => {
    if (success && !wasSuccess.current) api.current?.success();
    wasSuccess.current = success;
  }, [success]);

  useImperativeHandle(
    ref,
    () => ({
      loading: (on, options) => api.current?.loading(on, options),
      success: () => api.current?.success(),
    }),
    [],
  );

  const shared = {
    ...props,
    ref: svg,
    xmlns: "http://www.w3.org/2000/svg",
    width: size,
    height: size,
    fill: "none",
    focusable: "false" as const,
    className: ["ikm", className].filter(Boolean).join(" "),
    ...(title ? { role: "img" } : { "aria-hidden": true as const }),
  };
  const label = title ? <title>{title}</title> : null;
  const ids = { logs: `${id}-logs`, water: `${id}-water`, flow: `${id}-flow`, fade: `${id}-fade` };

  if (small) {
    const box = { maskUnits: "userSpaceOnUse", x: -8, y: -8, width: 32, height: 32 } as const;
    return (
      <svg viewBox="0 0 16 16" {...shared}>
        {label}
        <defs>
          <mask id={ids.logs} {...box}>
            <rect x="-8" y="-8" width="32" height="32" fill="#fff" />
            <rect x="6.875" y="2.5" width="1.25" height="5" fill="#000" />
            <rect x="10.375" y="7.5" width="1.25" height="5" fill="#000" />
            <circle cx="5" cy="5" r="0.6" fill="#000" />
            <circle cx="4" cy="10" r="0.6" fill="#000" />
          </mask>
          <mask id={ids.water} {...box}>
            <rect x="-8" y="-8" width="32" height="32" fill="#fff" />
            <path d={G16.cut} stroke="#000" strokeWidth="3" />
            <path d={G16.cut + G16.cutTail} fill="#000" />
          </mask>
        </defs>
        <g mask={`url(#${ids.water})`}>
          <g transform="translate(1.833 0) skewX(-18.435)">
            <path mask={`url(#${ids.logs})`} fill="currentColor" d={G16.logs} />
            <path d={G16.rope} stroke="currentColor" strokeWidth="1.25" strokeOpacity="0.5" />
          </g>
        </g>
        <path d={G16.wave} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  const box = { maskUnits: "userSpaceOnUse", x: -8, y: -8, width: 40, height: 40 } as const;
  const line = { stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" } as const;
  return (
    <svg viewBox="0 0 24 24" data-ikm-motion={motion} {...shared}>
      {label}
      <defs>
        <mask id={ids.logs} {...box}>
          <rect x="-8" y="-8" width="40" height="40" fill="#fff" />
          <rect x="9.5" y="4.5" width="2" height="6.5" fill="#000" />
          <rect x="15" y="11" width="2" height="6.5" fill="#000" />
          <circle cx="7.25" cy="7.75" r="1.1" fill="#000" />
          <circle cx="5.75" cy="14.25" r="1.1" fill="#000" />
        </mask>
        <mask id={ids.water} {...box}>
          <rect x="-8" y="-8" width="40" height="40" fill="#fff" />
          <g className="ikm-cut">
            <path d={G24.cut} stroke="#000" strokeWidth="4" />
            <path d={G24.cut + G24.cutTail} fill="#000" />
          </g>
        </mask>
        <linearGradient id={ids.fade} gradientUnits="userSpaceOnUse" x1="1.5" x2="22.5" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.119" stopColor="#fff" />
          <stop offset="0.881" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={ids.flow} {...box}>
          <rect x="1.5" y="-8" width="21" height="40" fill={`url(#${ids.fade})`} />
        </mask>
      </defs>
      <g mask={`url(#${ids.water})`}>
        <g className="ikm-raft">
          <g className="ikm-bob">
            <g transform="translate(2.5 0) skewX(-14.036)">
              <path mask={`url(#${ids.logs})`} fill="currentColor" d={G24.logs} />
              <path d={G24.rope} {...line} strokeOpacity="0.45" />
            </g>
          </g>
        </g>
      </g>
      <g className="ikm-water">
        <path className="ikm-echo" opacity="0" d={G24.wave} {...line} />
        <path className="ikm-wave" d={G24.wave} {...line} />
        <g className="ikm-flowwrap" mask={`url(#${ids.flow})`} opacity="0">
          <g className="ikm-flow">
            <path d={G24.flow} {...line} />
          </g>
        </g>
      </g>
    </svg>
  );
}
