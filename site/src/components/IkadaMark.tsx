/**
 * The ikada mark, "R2": three lashed logs and two solid ropes. Site-only. The library has no brand export
 * (the dashboards carry the Sproutboat mark), so this stays out of src/ and out of the shadcn registry.
 * One filled evenodd path in currentColor.
 *
 * Two drawings of the same silhouette: the 16-grid one at 16 px and below (static, hinted to whole
 * pixels), the 24-grid one above that, which carries the motion. Motion lives in ./ikada-mark-motion.ts
 * and the `.ikm` rules in site.css.
 */
import { useEffect, useImperativeHandle, useRef, type ComponentProps, type Ref } from "react";
import { mount, wire, type IkadaMarkMotion } from "./ikada-mark-motion";
import { M16, M24 } from "./ikada-mark-paths";

export interface IkadaMarkHandle {
  /** Start or stop the loading loop. Starts after `delay` ms (400 by default). */
  loading(on: boolean, options?: { delay?: number }): void;
  /** Play the success rise once. Ends a loading loop with a quick hand-off. */
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
    fill: "currentColor",
    focusable: "false" as const,
    className: ["ikm", className].filter(Boolean).join(" "),
    ...(title ? { role: "img" } : { "aria-hidden": true as const }),
  };
  const label = title ? <title>{title}</title> : null;

  if (small) {
    return (
      <svg viewBox="0 0 16 16" {...shared}>
        {label}
        <path fillRule="evenodd" d={M16} />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" data-ikm-motion={motion} {...shared}>
      {label}
      <g className="ikm-raft">
        <g className="ikm-bob">
          <path fillRule="evenodd" d={M24} />
        </g>
      </g>
    </svg>
  );
}
