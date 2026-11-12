"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "./cn";

interface Layer<T> {
  key: string;
  value: T;
  /** Added by a change, not by the first render: only these play the entrance. */
  fresh: boolean;
}

export interface CrossfadeProps<T> {
  /** Changes when the content is a different thing (new text, new glyph). Same key re-renders in place. */
  layerKey: string;
  value: T;
  /** `live` is true for the layer that stays; the outgoing one is rendered once more from its snapshot. */
  render: (value: T, live: boolean) => ReactNode;
  /**
   * "text" animates the height between layers; "slot" stacks centered layers in a fixed box (icons);
   * "inline" animates the width between layers and is made of spans, for the inside of a button.
   */
  kind?: "text" | "slot" | "inline";
  className?: string;
  /** Milliseconds until the outgoing layer is removed. Match the CSS duration. */
  settleMs?: number;
}

const layerMotion = [
  "transition-[opacity,filter,translate,scale] duration-(--sb-duration-toast-in) ease-out",
  // The incoming layer starts blurred and a few pixels low. --sb-move is 0 under reduced motion: only the fade stays.
  "starting:opacity-0 starting:blur-[3px] starting:translate-y-[calc(3px*var(--sb-move))]",
].join(" ");

const leaving = "pointer-events-none opacity-0 blur-[3px] -translate-y-[calc(3px*var(--sb-move))]";

// Inline (a button's label): opacity and a 3px blur only, nothing travels, and nothing plays on the first render.
const inlineMotion = "transition-[opacity,filter] duration-(--sb-duration-dialog-in) ease-(--ease-out)";
const inlineStart = "starting:opacity-0 starting:blur-[3px]";
const inlineLeaving = "pointer-events-none opacity-0 blur-[3px]";

/**
 * Crossfades between versions of its content: the old layer blurs out while the new one blurs in
 * (the blur hides that two different things overlap), and for text the box animates to the new height,
 * for inline content to the new width. A change that lands mid-fade starts from where things are:
 * the layers already leaving keep going and the new one is added on top. Opacity, translate, scale and
 * blur only; the height or width transition is the one exception and is a layout property on a box that
 * clips, so nothing around it moves except the neighbours a width change is meant to push.
 */
export function Crossfade<T>({ layerKey, value, render, kind = "text", className, settleMs = 340 }: CrossfadeProps<T>) {
  const [layers, setLayers] = useState<Layer<T>[]>([{ key: layerKey, value, fresh: false }]);
  const boxRef = useRef<HTMLDivElement>(null);
  const live = layers[layers.length - 1];
  if (live && live.key !== layerKey) setLayers([...layers, { key: layerKey, value, fresh: true }]);

  const morphing = layers.length > 1;
  const inline = kind === "inline";
  // A span inside a button (a div there is invalid HTML); the same props either way.
  const Tag = (inline ? "span" : "div") as "div";

  useEffect(() => {
    if (!morphing) return undefined;
    const timer = setTimeout(() => setLayers((l) => l.slice(-1)), settleMs);
    return () => clearTimeout(timer);
  }, [morphing, layers, settleMs]);

  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box || kind === "slot") return undefined;
    const prop = inline ? "width" : "height";
    if (!morphing) {
      box.style[prop] = "";
      return undefined;
    }
    // The outgoing layer is still in flow, so the box measures its size (or, mid-morph, the size it has reached);
    // pin it, then move to the new one.
    const from = inline ? box.offsetWidth : box.offsetHeight;
    box.style[prop] = `${from}px`;
    const incoming = box.querySelector<HTMLElement>("[data-layer=live]");
    let to = from;
    if (incoming) {
      if (inline) {
        // Absolutely placed and centred in the box, so ask for its own width, not the box's.
        incoming.style.width = "max-content";
        to = incoming.offsetWidth;
        incoming.style.width = "";
      } else to = incoming.offsetHeight;
    }
    const frame = requestAnimationFrame(() => {
      box.style[prop] = `${to}px`;
    });
    // Focus on a control in the outgoing layer would be lost; hand it to the toast itself.
    const active = box.ownerDocument.activeElement;
    if (active && box.querySelector("[data-layer=out]")?.contains(active)) {
      box.closest<HTMLElement>("[tabindex]")?.focus({ preventScroll: true });
    }
    return () => cancelAnimationFrame(frame);
  }, [layers, morphing, kind, inline]);

  return (
    <Tag
      ref={boxRef}
      data-crossfade={kind}
      data-morphing={morphing ? "" : undefined}
      className={cn(
        "relative min-w-0",
        kind === "text" &&
          "transition-[height] duration-(--sb-duration-toast-in) ease-out data-morphing:overflow-hidden",
        kind === "slot" && "grid size-6 place-items-center",
        // The width follows the content (0ms under reduced motion: it snaps and only the fade plays). The clip keeps
        // a wider label from spilling past the button, with room around the box for the blur.
        inline &&
          "inline-flex max-w-full items-center justify-center transition-[width] duration-[calc(var(--sb-duration-dialog-in)*var(--sb-move))] ease-(--ease-in-out) data-morphing:overflow-clip data-morphing:[overflow-clip-margin:0.5rem]",
        className,
      )}
    >
      {layers.map((layer, i) => {
        const isLive = i === layers.length - 1;
        // While morphing only the first layer stays in flow (it holds the old size); the rest are laid over it.
        const over = morphing && i > 0;
        return (
          <Tag
            key={layer.key}
            data-layer={isLive ? "live" : "out"}
            aria-hidden={isLive ? undefined : true}
            inert={isLive ? undefined : true}
            className={cn(
              inline ? inlineMotion : layerMotion,
              inline && layer.fresh && inlineStart,
              kind === "text" && "min-w-0",
              kind === "text" && over && "absolute inset-x-0 top-0",
              kind === "slot" && "col-start-1 row-start-1 grid place-items-center",
              kind === "slot" && !isLive && "absolute inset-0",
              kind === "slot" && "starting:scale-(--sb-scale-icon)",
              kind === "slot" && !isLive && "scale-(--sb-scale-icon)",
              inline && "inline-flex min-w-0 items-center justify-center gap-2",
              inline && over && "absolute inset-0",
              // The box is narrower or wider than the label for a moment: the label keeps its size and is clipped, never ellipsised.
              inline && morphing && "[&>*]:shrink-0",
              !isLive && (inline ? inlineLeaving : leaving),
            )}
          >
            {render(isLive ? value : layer.value, isLive)}
          </Tag>
        );
      })}
    </Tag>
  );
}
