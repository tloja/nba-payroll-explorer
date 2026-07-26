import Link from 'next/link';
import type { Metadata } from 'next';
import { CORRECTIONS_LOG } from '../../data/corrections';

const CORRECTIONS_EMAIL = 'tronjopvp@gmail.com';

export const metadata: Metadata = {
  title: 'Corrections — NBA Payroll Explorer',
  description: 'How to report an error on this site, and a public log of what has been corrected.',
};

export default function CorrectionsPage() {
  const mailtoHref = `mailto:${CORRECTIONS_EMAIL}?subject=${encodeURIComponent(
    'NBA Payroll Explorer correction',
  )}&body=${encodeURIComponent(
    'Team:\nSeason:\nPlayer or charge:\nWhat looks wrong:\nWhat you think it should be (with a source, if you have one):\n',
  )}`;

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/" className="text-sm text-[#52514e] underline">
        &larr; Home
      </Link>
      <h1 className="mt-2 text-xl font-semibold">Corrections</h1>
      <p className="mt-2 text-sm leading-relaxed">
        This site follows a strict{' '}
        <Link href="/methodology" className="underline">
          methodology
        </Link>{' '}
        and checks itself against its{' '}
        <Link href="/sources" className="underline">
          sources
        </Link>
        , but figures can still be wrong &mdash; a source updates its page, a trade or waiver hasn&apos;t been
        reflected yet, or a parsing bug slipped through. If something looks off, please report it.
      </p>

      <h2 className="mt-8 text-lg font-semibold">How to report an error</h2>
      <p className="mt-2 text-sm leading-relaxed">
        Email{' '}
        <a href={mailtoHref} className="underline">
          {CORRECTIONS_EMAIL}
        </a>{' '}
        with the team, season, and player or charge in question, what looks wrong, and (if you have one) a source
        for what it should be instead. The link above pre-fills a template with those fields.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[#52514e]">
        This site is a static export with no server or database behind it (see{' '}
        <Link href="/privacy" className="underline">
          privacy
        </Link>
        ), so there's nowhere for an in-page submission form to send data &mdash; email is the only way to reach
        us right now.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Correction log</h2>
      {CORRECTIONS_LOG.length === 0 ? (
        <p className="mt-2 text-sm leading-relaxed text-[#52514e]">
          No corrections have been logged yet. This log is genuinely empty at launch, not a placeholder waiting to
          be filled in &mdash; the first entry will appear here the first time a reported error changes something on
          the site.
        </p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#d8d6cf]">
                <th scope="col" className="py-1.5 pr-3 font-semibold">Date</th>
                <th scope="col" className="py-1.5 pr-3 font-semibold">Scope</th>
                <th scope="col" className="py-1.5 pr-3 font-semibold">What was wrong</th>
                <th scope="col" className="py-1.5 pr-3 font-semibold">What changed</th>
              </tr>
            </thead>
            <tbody>
              {[...CORRECTIONS_LOG]
                .sort((a, b) => (a.date < b.date ? 1 : -1))
                .map((entry, i) => (
                  <tr key={i} className="border-b border-[#eeeee7]">
                    <td className="py-1 pr-3 align-top">{entry.date}</td>
                    <td className="py-1 pr-3 align-top">{entry.scope}</td>
                    <td className="py-1 pr-3 align-top">{entry.description}</td>
                    <td className="py-1 pr-3 align-top">{entry.resolution}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
