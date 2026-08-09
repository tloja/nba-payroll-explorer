'use client';

import { useLayoutEffect, useState } from 'react';

export type ColorScheme = 'light' | 'dark';

function resolve(): ColorScheme {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'light' || attr === 'dark') return attr;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Live-tracks the resolved color scheme (an explicit `data-theme` override
 * from ThemeToggle, or the OS `prefers-color-scheme` when unset) so chart
 * components can pick literal hex ink/canvas colors per theme.
 *
 * Deliberately never exposes a `var(--x)` CSS custom property for use
 * inside an SVG presentation attribute — only resolved hex strings. That
 * matters specifically for PayrollChart's download-PNG feature: it clones
 * and serializes the live `<svg>` into a *standalone* document with no
 * access to the page's `:root` custom properties, so a `var()`-based
 * fill/stroke would render correctly on screen but silently fail to
 * resolve once exported. Reading already-resolved hex here means the
 * exported PNG always matches what's on screen, in either theme, with no
 * separate code path to keep in sync.
 *
 * Defaults to 'light' before mount (server-safe; matches ThemeToggle's own
 * pattern) and corrects via `useLayoutEffect` — before paint, same
 * reasoning as `useContainerWidth`'s own layout-effect fix (NOTES.md) for
 * why a *regular* effect would risk one visible frame of the wrong theme.
 */
export function useColorScheme(): ColorScheme {
  const [scheme, setScheme] = useState<ColorScheme>('light');

  useLayoutEffect(() => {
    setScheme(resolve());

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setScheme(resolve());
    media.addEventListener('change', onChange);

    // Catches ThemeToggle's explicit override too — it just sets the
    // `data-theme` attribute directly, so observing that attribute (rather
    // than requiring ThemeToggle to also dispatch a custom event) is the
    // single source of truth every consumer can share.
    const observer = new MutationObserver(onChange);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    return () => {
      media.removeEventListener('change', onChange);
      observer.disconnect();
    };
  }, []);

  return scheme;
}
