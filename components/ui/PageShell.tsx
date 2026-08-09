import Link from 'next/link';
import type { ReactNode } from 'react';

// Shared header treatment for the six supporting-content pages (M12 brief
// item 3: "cleaner card/section layout" for methodology/glossary/
// corrections/about — extended here to sources/privacy too, so no static
// page is left on the old plain-hex styling once dark mode is site-wide;
// see NOTES.md for why leaving any page untouched isn't actually neutral
// once the layout's own background can go dark). One implementation of
// back-link + heading + intro, so the six pages can't drift into describing
// the same kind of content differently from each other.
export function PageShell({
  backHref,
  backLabel,
  title,
  intro,
  children,
  maxWidth = 'max-w-3xl',
}: {
  backHref: string;
  backLabel: string;
  title: string;
  intro?: ReactNode;
  children: ReactNode;
  maxWidth?: string;
}) {
  return (
    <main id="main-content" tabIndex={-1} className={`mx-auto ${maxWidth} px-4 py-8`}>
      <Link
        href={backHref}
        className="text-sm text-ink-muted underline underline-offset-2 outline-none hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        &larr; {backLabel}
      </Link>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink [text-wrap:balance]">{title}</h1>
      {intro && <p className="mt-3 max-w-[65ch] text-sm leading-relaxed text-ink-muted">{intro}</p>}
      <div className="mt-8 flex flex-col gap-4">{children}</div>
    </main>
  );
}
