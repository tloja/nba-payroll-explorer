'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Measures the actual rendered width of a container element via
 * ResizeObserver. The chart re-derives its D3 scales and label layout from
 * this real pixel width rather than scaling an SVG viewBox, so text stays a
 * constant, legible size at every breakpoint instead of shrinking with the
 * container (spec: render correctly at 1440px, 768px, and 390px).
 */
export function useContainerWidth<T extends HTMLElement>(fallback = 960) {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}
