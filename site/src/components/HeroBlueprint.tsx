import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ToastProvider } from "../../../src/components/toast";
import { TooltipProvider } from "../../../src/components/tooltip";
import { Sheet } from "../hero/blueprint/Sheet";
import "../hero/blueprint/blueprint.css";

/**
 * The /ikada hero: the chart has zoomed to the raft, and a blueprint of the raft opens from the raft marker over it.
 * The sheet's seven parts are real ikada components. It waits for the chart (the `hero:ready` event from hero/home.ts,
 * or 2.2 s) so that, arriving from sproutboat.com, the zoom lands first and the paper opens as the camera settles.
 * While it covers the chart the markers are inert and home.ts pauses the chart's frames (`hero:sheet`).
 */
declare global {
  interface Window {
    __heroReady?: boolean;
  }
}

export default function HeroBlueprint() {
  const root = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number; copyBottom: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [reduced, setReduced] = useState(false);

  useLayoutEffect(() => {
    const shell = root.current?.closest<HTMLElement>("[data-hero-shell]");
    if (!shell) return undefined;
    // the bottom of the copy (the actions), where the drawing may start on a phone
    const measure = (): void => {
      const ctl = shell.querySelector<HTMLElement>("[data-hero-mask=ctl]");
      const copyBottom = ctl ? ctl.getBoundingClientRect().bottom - shell.getBoundingClientRect().top : 0;
      setSize({ w: shell.clientWidth, h: shell.clientHeight, copyBottom: Math.round(copyBottom) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(shell);
    document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const read = (): void => setReduced(html.dataset.motion === "reduce" || mq.matches);
    read();
    mq.addEventListener("change", read);
    const mo = new MutationObserver(read);
    mo.observe(html, { attributes: true, attributeFilter: ["data-motion"] });
    return () => {
      mq.removeEventListener("change", read);
      mo.disconnect();
    };
  }, []);

  // open once the chart is up (or after a beat, if there is no chart: the poster is the picture)
  useEffect(() => {
    let done = false;
    const go = (): void => {
      if (done) return;
      done = true;
      // draw the closed sheet first (one frame), then open it: the page is never asked for both at once
      setMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true))));
    };
    if (window.__heroReady) go();
    window.addEventListener("hero:ready", go, { once: true });
    const t = window.setTimeout(go, 2200);
    return () => {
      window.removeEventListener("hero:ready", go);
      clearTimeout(t);
    };
  }, []);

  // the chart's markers are out of reach while the sheet covers them; home.ts pauses the chart
  useEffect(() => {
    const shell = root.current?.closest<HTMLElement>("[data-hero-shell]");
    const markers = shell?.querySelector<HTMLElement>("[data-hero-markers]");
    if (markers) {
      markers.inert = open;
      if (open) markers.setAttribute("aria-hidden", "true");
      else markers.removeAttribute("aria-hidden");
    }
    if (shell) shell.dataset.blueprint = open ? "open" : "closed";
    window.dispatchEvent(new CustomEvent("hero:sheet", { detail: open }));
  }, [open]);

  // the live components are a lazy chunk: fetch it in idle time once the sheet is up
  useEffect(() => {
    if (!open) return undefined;
    const idle = (window as unknown as { requestIdleCallback?: (f: () => void, o?: object) => number })
      .requestIdleCallback;
    const t = idle
      ? idle(() => void import("../hero/blueprint/live"), { timeout: 3000 })
      : window.setTimeout(() => void import("../hero/blueprint/live"), 1500);
    return () =>
      idle ? (window as unknown as { cancelIdleCallback: (n: number) => void }).cancelIdleCallback(t) : clearTimeout(t);
  }, [open]);

  return (
    <div ref={root} className="bp" data-open={open || undefined} data-reduced={reduced || undefined} data-chart-ignore>
      <ToastProvider>
        <TooltipProvider>
          {size && mounted && <Sheet w={size.w} h={size.h} armed={open} copyBottom={size.copyBottom} />}
        </TooltipProvider>
      </ToastProvider>
    </div>
  );
}
