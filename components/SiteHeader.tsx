import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle';
import { SITE_NAME } from '../lib/site';

// Site-wide nav (M12 brief item 4: "navigation" is chrome, in scope). A text
// wordmark, never a logo (spec §7 / CLAUDE.md: no NBA/team marks anywhere,
// including here) — mono, uppercase, tracked out, reads as a ledger heading
// rather than a brand mark. Per-page back-links ("← All teams", "← {team},
// all seasons") stay where they are; this is the persistent piece those
// contextual links don't replace.
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link
          href="/"
          className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-ink outline-none hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {SITE_NAME}
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
