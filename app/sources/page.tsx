import Link from 'next/link';
import type { Metadata } from 'next';
import { computeDatasetStats } from '../../lib/data/stats';
import { formatRetrievedAt } from '../../lib/format';
import { PageShell } from '../../components/ui/PageShell';
import { Section, Aside } from '../../components/ui/Section';

export const metadata: Metadata = {
  title: 'Sources — NBA Payroll Explorer',
  description: 'Where the contract data and threshold figures on this site come from, per source.',
};

export default function SourcesPage() {
  const stats = computeDatasetStats();

  return (
    <PageShell
      backHref="/"
      backLabel="Home"
      title="Sources"
      intro={
        <>
          This site derives every displayed dollar figure from its own rules engine rather than copying another
          site&apos;s computed totals &mdash; see{' '}
          <Link href="/methodology" className="text-accent underline underline-offset-2 hover:text-accent-strong">
            methodology
          </Link>{' '}
          for how. This page lists what raw data feeds that engine, and where it comes from.
        </>
      }
    >
      <Section heading="Contract data: Basketball-Reference">
        <p>
          Contract primitives &mdash; each season&apos;s scheduled salary, guarantee status, and option type
          &mdash; are read from each team&apos;s contracts page on{' '}
          <a href="https://www.basketball-reference.com/" rel="noopener noreferrer" target="_blank">
            Basketball-Reference
          </a>
          . This site does not copy Basketball-Reference&apos;s own computed cap/tax/apron labels; it re-derives
          cap hits, dead money, and apron payroll independently through{' '}
          <Link href="/methodology">its own rules engine</Link>. For standard contracts, Basketball-Reference
          already publishes the resolved per-season dollar figure (rather than a start-salary-plus-raise-percentage
          pair), so this site&apos;s output for those seasons will match Basketball-Reference&apos;s own number
          &mdash; the independence is in how it&apos;s derived and stored, and in the engine being what computes
          dead money, stretch schedules, and the cap/tax/apron distinction, none of which
          Basketball-Reference&apos;s contract table itself provides.
        </p>
        <p>
          This site&apos;s ingestion respects Basketball-Reference&apos;s <code>robots.txt</code> crawl-delay
          directive automatically (rather than a hardcoded guess), identifies itself with a descriptive User-Agent,
          fetches each team sequentially, caches results and re-fetches at most once a day, and aborts the entire
          run immediately on a rate-limit or access-denied response rather than retrying.
        </p>
        <Aside>
          Known gap: Basketball-Reference&apos;s contracts page lists signed deals only &mdash; it has no cap
          holds, draft-rights holds, or incomplete-roster charges. Those charge types exist in this site&apos;s
          data model (see <Link href="/methodology">methodology</Link>) but nothing currently supplies real
          numbers for them, for any team.
        </Aside>
      </Section>

      <Section heading="Threshold figures: the NBA's own announcements">
        <p>
          The salary cap, luxury tax level, and both apron figures are the league&apos;s own publicly announced
          numbers for each season, entered directly into this site&apos;s codebase rather than scraped from any
          third party. Minimum team salary, where not directly announced, is computed from the CBA&apos;s published
          formula (90% of that season&apos;s cap).
        </p>
        <Aside>
          Unlike individual cap charges, these threshold figures don&apos;t currently carry a per-value retrieval
          timestamp or source link in the data model &mdash; there are only a handful of them, updated once a
          year, and that provenance tracking hasn&apos;t been built out yet. This is a disclosed simplification,
          not a hidden gap.
        </Aside>
      </Section>

      <Section heading="Not used">
        <ul>
          <li>
            <strong>Spotrac</strong> &mdash; not scraped. Their terms of service prohibit it, and they sell a
            commercial data API; republishing their compilation without a license is the clearest way to invite a
            legal problem.
          </li>
          <li>No other commercial data license has been pursued for this project yet.</li>
        </ul>
      </Section>

      <Section heading="Dataset snapshot">
        <p className="font-mono text-ink-muted">
          {stats.loadedTeamCount} of {stats.teamCount} teams loaded &middot;{' '}
          {stats.chargeCount.toLocaleString('en-US')} total cap charges &middot; retrieved{' '}
          {stats.lastUpdatedAt ? formatRetrievedAt(stats.lastUpdatedAt) : 'not yet run'}
        </p>
        {stats.failedSlugs.length > 0 && (
          <Aside>
            {stats.failedSlugs.length} team file(s) failed to load: {stats.failedSlugs.join(', ')}.
          </Aside>
        )}
        <Aside>Computed live from the data currently on this site, not a fixed snapshot.</Aside>
      </Section>

      <Section heading="Something looks wrong?">
        <p>
          See <Link href="/corrections">corrections</Link> for how to report it.
        </p>
      </Section>
    </PageShell>
  );
}
