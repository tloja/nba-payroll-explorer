import Link from 'next/link';
import type { Metadata } from 'next';
import { CORRECTIONS_LOG } from '../../data/corrections';
import { PageShell } from '../../components/ui/PageShell';
import { Section, Aside } from '../../components/ui/Section';

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
    <PageShell
      backHref="/"
      backLabel="Home"
      title="Corrections"
      intro={
        <>
          This site follows a strict{' '}
          <Link href="/methodology" className="text-accent underline underline-offset-2 hover:text-accent-strong">
            methodology
          </Link>{' '}
          and checks itself against its{' '}
          <Link href="/sources" className="text-accent underline underline-offset-2 hover:text-accent-strong">
            sources
          </Link>
          , but figures can still be wrong &mdash; a source updates its page, a trade or waiver hasn&apos;t been
          reflected yet, or a parsing bug slipped through. If something looks off, please report it.
        </>
      }
    >
      <Section heading="How to report an error" emphasis>
        <p>
          Email{' '}
          <a href={mailtoHref} className="font-medium">
            {CORRECTIONS_EMAIL}
          </a>{' '}
          with the team, season, and player or charge in question, what looks wrong, and (if you have one) a source
          for what it should be instead. The link above pre-fills a template with those fields.
        </p>
        <Aside>
          This site is a static export with no server or database behind it (see{' '}
          <Link href="/privacy">privacy</Link>), so there&apos;s nowhere for an in-page submission form to send data
          &mdash; email is the only way to reach us right now.
        </Aside>
      </Section>

      <Section heading="Correction log">
        {CORRECTIONS_LOG.length === 0 ? (
          <Aside>
            No corrections have been logged yet. This log is genuinely empty at launch, not a placeholder waiting
            to be filled in &mdash; the first entry will appear here the first time a reported error changes
            something on the site.
          </Aside>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="py-1.5 pr-3 font-semibold text-ink">Date</th>
                  <th scope="col" className="py-1.5 pr-3 font-semibold text-ink">Scope</th>
                  <th scope="col" className="py-1.5 pr-3 font-semibold text-ink">What was wrong</th>
                  <th scope="col" className="py-1.5 pr-3 font-semibold text-ink">What changed</th>
                </tr>
              </thead>
              <tbody>
                {[...CORRECTIONS_LOG]
                  .sort((a, b) => (a.date < b.date ? 1 : -1))
                  .map((entry, i) => (
                    <tr key={i} className="border-b border-line">
                      <td className="py-1 pr-3 align-top text-ink-muted">{entry.date}</td>
                      <td className="py-1 pr-3 align-top text-ink-muted">{entry.scope}</td>
                      <td className="py-1 pr-3 align-top text-ink-muted">{entry.description}</td>
                      <td className="py-1 pr-3 align-top text-ink-muted">{entry.resolution}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </PageShell>
  );
}
