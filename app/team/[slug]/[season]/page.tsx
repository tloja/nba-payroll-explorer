import Link from 'next/link';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { listTeamSlugs, listTeamSeasonPairs, loadTeamFile } from '../../../../lib/data/teams';
import { availableSeasonsFor, lastUpdatedFor } from '../../../../lib/data/teamPayroll';
import { TeamPageClient } from '../../../../components/team/TeamPageClient';
import { TeamStructuredData } from '../../../../components/TeamStructuredData';
import type { Season } from '../../../../lib/types';
import { formatRetrievedAt } from '../../../../lib/format';
import { summarizeTeamSeason } from '../../../../lib/seo/teamSummary';
import { SITE_NAME, SITE_URL } from '../../../../lib/site';

function PayrollChartFallback() {
  return (
    // Same themed card treatment as the real chart — see PayrollChart.tsx.
    <div
      className="mt-4 h-[932px] w-full animate-pulse rounded-2xl border border-line bg-surface-raised lg:absolute lg:right-0 lg:top-0 lg:mt-0 lg:w-[calc(100%-330px)]"
      aria-hidden="true"
    />
  );
}

export function generateStaticParams() {
  return listTeamSeasonPairs();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; season: string }>;
}): Promise<Metadata> {
  const { slug, season } = await params;
  const result = loadTeamFile(slug);
  const teamLabel = result.ok ? result.data.teamLabel : slug.toUpperCase();
  const title = `${teamLabel} — ${season} — ${SITE_NAME}`;
  const summary = result.ok ? summarizeTeamSeason(result.data, season as Season) : null;
  const description = summary?.description ?? `${teamLabel}'s ${season} payroll, cap sheet, and apron status.`;

  // /team/[slug] currently renders exactly this one season whenever a team
  // has only one available season (today, every team does — see
  // availableSeasonsFor's NOTES.md M4 entry). In that case this page and the
  // un-seasoned hub are byte-identical content, so this page canonicalizes to
  // the hub rather than competing with it (spec §10 item 7). Once a team has
  // more than one season, the hub shows a range and this deep link shows a
  // single slice — genuinely different content — so it canonicalizes to
  // itself instead. Computed from live data, not hardcoded, so it tracks
  // forward the moment data/thresholds.ts grows past two seasons.
  const seasons = result.ok ? availableSeasonsFor(result.data) : [];
  const isOnlySeason = seasons.length === 1 && seasons[0] === season;
  const canonicalPath = isOnlySeason ? `/team/${slug}` : `/team/${slug}/${season}`;

  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: { title, description, url: `${SITE_URL}${canonicalPath}` },
    // See app/team/[slug]/page.tsx's generateMetadata for why `card` must be
    // repeated here rather than inherited from the root layout.
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function TeamSeasonPage({
  params,
}: {
  params: Promise<{ slug: string; season: string }>;
}) {
  const { slug, season } = await params;
  if (!listTeamSlugs().includes(slug)) notFound();

  const result = loadTeamFile(slug);
  if (!result.ok) {
    return (
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-[1290px] px-4 py-8">
        <Link
          href="/"
          className="text-sm text-ink-muted underline underline-offset-2 outline-none hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          &larr; All teams
        </Link>
        <p className="mt-4 text-sm text-ink-muted">
          This team&apos;s data could not be loaded ({result.error}).
        </p>
      </main>
    );
  }

  const seasons = availableSeasonsFor(result.data);
  if (!seasons.includes(season as Season)) notFound();

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-[1290px] px-4 py-8">
      <TeamStructuredData teamLabel={result.data.teamLabel} slug={slug} />
      <Link
        href={`/team/${slug}`}
        className="text-sm text-ink-muted underline underline-offset-2 outline-none hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        &larr; {result.data.teamLabel}, all seasons
      </Link>
      {/* Same responsive header layout as /team/[slug] — see that page.tsx
          for the full explanation (relative container + absolute chart +
          margin-reserved sidebar, not a CSS grid). */}
      <div className="lg:relative lg:min-h-[980px]">
        <div className="min-w-0 lg:w-[290px]">
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink [text-wrap:balance]">
            {result.data.teamLabel} — {season}
          </h1>
          {(() => {
            const lastUpdated = lastUpdatedFor(result.data);
            return lastUpdated ? (
              <p className="mt-1 text-xs text-ink-muted">
                Data last updated {formatRetrievedAt(lastUpdated)}. See{' '}
                <Link
                  href="/methodology"
                  className="text-accent underline underline-offset-2 outline-none hover:text-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  methodology
                </Link>{' '}
                and{' '}
                <Link
                  href="/sources"
                  className="text-accent underline underline-offset-2 outline-none hover:text-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  sources
                </Link>
                .
              </p>
            ) : null;
          })()}
        </div>
        {/* availableSeasons={[season]} locks TeamPageClient to this one season —
            its range selector auto-hides (length > 1 is false) while pin
            + toggle URL handling (M5) still applies, so this deep link stays
            fully shareable per spec §10 without a second implementation. */}
        <Suspense fallback={<PayrollChartFallback />}>
          <TeamPageClient
            slug={slug}
            data={result.data}
            availableSeasons={[season as Season]}
            basePath={`/team/${slug}/${season}`}
          />
        </Suspense>
      </div>
    </main>
  );
}
