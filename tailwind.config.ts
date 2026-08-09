import type { Config } from 'tailwindcss';

// Tailwind is layout chrome only (CLAUDE.md) — the chart's own <svg> is
// hand-authored and keeps its validated, out-of-scope ink/mechanism/team
// colors as literal hex (see PayrollChart.tsx, lib/chart/colors.ts,
// lib/team-colors.ts), never these tokens. Everything else — page
// background, cards, controls, nav — reads color through the CSS custom
// properties in globals.css, which swap per-theme; Tailwind here just gives
// them class names. M12: dark mode is opt-in via `data-theme` on <html>
// (ThemeToggle.tsx sets it, falling back to `prefers-color-scheme` in
// globals.css when unset), so `dark:` variants are unnecessary — every
// token-based utility already repaints itself when the variable changes.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: 'var(--paper)',
        surface: 'var(--surface)',
        'surface-raised': 'var(--surface-raised)',
        ink: 'var(--ink)',
        'ink-muted': 'var(--ink-muted)',
        line: 'var(--line)',
        accent: {
          DEFAULT: 'var(--accent)',
          strong: 'var(--accent-strong)',
          ink: 'var(--accent-ink)',
          soft: 'var(--accent-soft)',
        },
      },
      fontFamily: {
        // next/font/google (app/layout.tsx) self-hosts IBM Plex at build
        // time — no runtime font-CDN request, works under `output: 'export'`.
        // Chosen over a system-ui default (this milestone's actual ask) and
        // over Inter/Space Grotesk (the genre's own "safe default" — see the
        // frontend-design skill): Plex was designed by IBM specifically for
        // dense technical/financial UI, which is what a cap-sheet site is,
        // and Plex Mono already gives every dollar figure real tabular
        // digits instead of the generic ui-monospace stack.
        sans: ['var(--font-sans)', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
