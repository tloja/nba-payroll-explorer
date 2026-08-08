'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Measures the actual rendered width of a container element via
 * ResizeObserver. The chart re-derives its D3 scales and label layout from
 * this real pixel width rather than scaling an SVG viewBox, so text stays a
 * constant, legible size at every breakpoint instead of shrinking with the
 * container (spec: render correctly at 1440px, 768px, and 390px).
 *
 * `fallback` is what `width` holds before any real measurement exists.
 * `hasMeasured` is what callers should actually gate width-dependent
 * rendering on — see below for why `width !== fallback` isn't a safe proxy
 * for that.
 *
 * A `useLayoutEffect` (not `useEffect`) does the first measurement,
 * synchronously right after the DOM commits — before the browser paints —
 * so a pure client-side mount never visibly paints `fallback`'s geometry at
 * all. That alone is enough for the actual production build (static
 * export): confirmed via a real static-exported page served locally that
 * this chart never appears in the server-rendered HTML in the first place —
 * only its loading skeleton does, since it sits inside a Suspense boundary
 * whose real content depends on `useSearchParams` — so the very first time
 * this component's DOM exists at all is this client-side mount, which the
 * layout effect corrects before that first paint.
 *
 * `next dev` genuinely differs, though (M11 follow-up, found the hard way
 * after "the fix" still visibly flashed locally): its dev server *does*
 * synchronously SSR this component's real content, fallback width and all
 * — confirmed via `curl`, `width="960"` baked directly into the raw
 * response HTML — something the actual static-export build never does. In
 * that case the wrong-width geometry is already painted, for real, from
 * server HTML before any client JS has even loaded, and no client-side
 * effect (layout or otherwise) can retroactively un-paint a frame the
 * browser already committed. `hasMeasured` exists so a caller can render a
 * neutral loading placeholder instead of geometry at all until a real
 * measurement lands — `false` on both the server and the client's first
 * (pre-effect) render, so server and client markup still match (no
 * hydration error), and it becomes `true` only once `getBoundingClientRect`
 * has actually run. That turns dev mode's slow hydration into an honest
 * "loading, then correct" instead of "wrong, then correct."
 */
export function useContainerWidth<T extends HTMLElement>(fallback = 960) {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(fallback);
  const [hasMeasured, setHasMeasured] = useState(false);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measured = node.getBoundingClientRect().width;
    if (measured > 0) {
      setWidth(measured);
      setHasMeasured(true);
    }
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setWidth(entry.contentRect.width);
        setHasMeasured(true);
      }
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, width, hasMeasured };
}
