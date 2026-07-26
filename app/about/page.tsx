import Link from 'next/link';
import type { Metadata } from 'next';
import { TRADEMARK_DISCLAIMER } from '../../components/Footer';

const CONTACT_EMAIL = 'tronjopvp@gmail.com';

export const metadata: Metadata = {
  title: 'About — NBA Payroll Explorer',
  description: 'What this site is, who runs it, and its affiliation disclaimer.',
};

export default function AboutPage() {
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/" className="text-sm text-[#52514e] underline">
        &larr; Home
      </Link>
      <h1 className="mt-2 text-xl font-semibold">About</h1>

      <p className="mt-4 text-sm leading-relaxed">
        NBA Payroll Explorer shows every NBA team&apos;s cap charges &mdash; player contracts, dead money, cap holds,
        and more &mdash; as a single stacked chart per season, drawn against the salary cap, luxury tax line, and
        both apron thresholds. The goal is to make a team&apos;s full financial picture, not just its player
        salaries, legible at a glance, and to show exactly how every number was derived rather than presenting a
        total with no way to check it.
      </p>

      <p className="mt-4 text-sm leading-relaxed">
        It&apos;s an independent, non-commercial project built and maintained by one person, not by a media outlet,
        data vendor, or the league. It doesn&apos;t sell access to its data or run advertising. See{' '}
        <Link href="/methodology" className="underline">
          methodology
        </Link>{' '}
        and{' '}
        <Link href="/sources" className="underline">
          sources
        </Link>{' '}
        for exactly how the figures are calculated and where the underlying contract data comes from.
      </p>

      <p className="mt-4 text-sm leading-relaxed">
        This site uses team names to identify the teams it&apos;s describing, which is standard editorial/informational
        use. It does not use any NBA or team logos, wordmarks, or player photos, anywhere on the site &mdash; including
        favicons and any shared images &mdash; and reproduces only a single reference color per team, not a team&apos;s
        full brand system.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Disclaimer</h2>
      <p className="mt-2 text-sm leading-relaxed font-medium">{TRADEMARK_DISCLAIMER}</p>

      <h2 className="mt-8 text-lg font-semibold">Contact</h2>
      <p className="mt-2 text-sm leading-relaxed">
        For anything else, including error reports (see{' '}
        <Link href="/corrections" className="underline">
          corrections
        </Link>
        ), reach out at{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
          {CONTACT_EMAIL}
        </a>
        .
      </p>
    </main>
  );
}
