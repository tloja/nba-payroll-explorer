'use client';

import { useEffect, useState } from 'react';
import { useColorScheme } from '../lib/theme';

/**
 * Manual override for the M12 dark-mode requirement: first load respects
 * `prefers-color-scheme` with no JS at all (globals.css); this button lets a
 * visitor override that, persisted in localStorage and re-applied before
 * paint on the next visit by ThemeScript. Display state comes from the
 * shared `useColorScheme` hook (lib/theme.ts) — the same one PayrollChart/
 * LeagueOverview use to pick canvas-ink colors — so there's exactly one
 * definition of "what theme is currently active," read here and written by
 * `toggle()` below. ThemeScript already applied the *real* colors before
 * this component ever paints, so the only thing that can flash for one
 * frame (before the hook's layout effect corrects it) is this button's own
 * icon, never the page's theme.
 */
export function ThemeToggle() {
  const theme = useColorScheme();
  const [mounted, setMounted] = useState(false);

  // useColorScheme defaults to 'light' before its own layout effect runs;
  // this just tracks whether that correction has happened yet, purely to
  // decide when it's safe to show the moon icon (see the icon logic below).
  useEffect(() => setMounted(true), []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('theme', next);
    } catch {
      // Private-browsing/storage-disabled: the override just won't persist
      // across visits, which is a graceful degradation, not an error.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      aria-pressed={theme === 'dark'}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface text-ink-muted outline-none transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {/* aria-hidden: the button's own aria-label already announces state;
          suppressHydrationWarning on the icon choice since `mounted` flips
          client-only and a same-render server/client mismatch here is
          expected and harmless (see this component's own doc comment). */}
      <span aria-hidden="true" suppressHydrationWarning>
        {mounted && theme === 'dark' ? <MoonIcon /> : <SunIcon />}
      </span>
    </button>
  );
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.4" />
      <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <path d="M8 1.25v1.75M8 13v1.75M1.25 8h1.75M13 8h1.75" />
        <path d="M3.4 3.4l1.25 1.25M11.35 11.35l1.25 1.25M3.4 12.6l1.25-1.25M11.35 4.65l1.25-1.25" />
      </g>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M13.5 9.5A5.75 5.75 0 016.5 2.5a5.75 5.75 0 107 7z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
