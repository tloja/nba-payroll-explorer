import Link from 'next/link';

// The one-sentence trademark/affiliation disclaimer (spec §7): exported so
// /about can quote the exact same sentence rather than a paraphrase, per the
// spec's "the same one-sentence... disclaimer" wording.
export const TRADEMARK_DISCLAIMER =
  'NBA Payroll Explorer is an independent project and is not affiliated with, endorsed by, or sponsored by the NBA, the NBPA, or any team.';

const LINKS: { href: string; label: string }[] = [
  { href: '/methodology', label: 'Methodology' },
  { href: '/sources', label: 'Sources' },
  { href: '/glossary', label: 'Glossary' },
  { href: '/corrections', label: 'Corrections' },
  { href: '/about', label: 'About' },
  { href: '/privacy', label: 'Privacy' },
];

export function Footer() {
  return (
    <footer className="mx-auto mt-12 max-w-6xl px-4 py-6">
      <nav aria-label="Site" className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-ink-muted underline underline-offset-2 outline-none hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <p className="border-t border-line pt-3 text-xs text-ink-muted">{TRADEMARK_DISCLAIMER}</p>
    </footer>
  );
}
