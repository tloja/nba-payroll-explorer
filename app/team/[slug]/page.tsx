import Link from 'next/link';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { listTeamSlugs, loadTeamFile } from '../../../lib/data/teams';
import { availableSeasonsFor, lastUpdatedFor } from '../../../lib/data/teamPayroll';
import { TeamPageClient } from '../../../components/team/TeamPageClient';
import { TeamStructuredData } from '../../../components/TeamStructuredData';
import { formatRetrievedAt } from '../../../lib/format';
import { summarizeTeamSeason } from '../../../lib/seo/teamSummary';
import { SITE_NAME, SITE_URL } from '../../../lib/site';

export function generateStaticParams() {
  return listTeamSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = loadTeamFile(slug);
  const teamLabel = result.ok ? result.data.teamLabel : slug.toUpperCase();
  const title = `${teamLabel} — ${SITE_NAME}`;

  // The hub always describes the most recent season it currently renders
  // (TeamPageClient defaults `to` to the last available season) — same
  // reasoning `pickLeagueSeason` (app/page.tsx) already uses.
  const seasons = result.ok ? availableSeasonsFor(result.data) : [];
  const latestSeason = seasons[seasons.length - 1];
  const summary = result.ok && latestSeason ? summarizeTeamSeason(result.data, latestSeason) : null;
  const description = summary?.description ?? `${teamLabel}'s cap sheet, dead money, cap holds, and apron status by season.`;
  const canonicalPath = `/team/${slug}`;

  return {
    title,
    description,
    // /team/[slug] is always the canonical hub for this team — see the
    // [season] route's generateMetadata for the reverse case (a single-season
    // deep link pointing back here when it'd otherwise be duplicate content).
    alternates: { canonical: canonicalPath },
    openGraph: { title, description, url: `${SITE_URL}${canonicalPath}` },
    // Next.js doesn't deep-merge a route's `twitter` object with the root
    // layout's — specifying one here fully replaces the layout's, which
    // silently dropped `card: 'summary_large_image'` until this was made
    // explicit (found via a real curl of the rendered <head>, not assumed).
    // `card` alone wasn't enough to flip the rendered meta tag away from
    // Next's 'summary' default — it only took effect once `images` was also
    // given explicitly here rather than left to the opengraph-image.tsx file
    // convention's own auto-injection (also confirmed by re-curling the
    // rendered <head>, not assumed).
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${canonicalPath}/opengraph-image`],
    },
  };
}

function PayrollChartFallback() {
  return (
    // Same themed card treatment as the real chart (PayrollChart.tsx) — this
    // skeleton only ever flashes during client-side navigation, but it
    // should still look like "the chart is loading," not "the theme is
    // broken," while it's up.
    <div
      className="mt-4 h-[932px] w-full animate-pulse rounded-2xl border border-line bg-surface-raised lg:absolute lg:right-0 lg:top-0 lg:mt-0 lg:w-[calc(100%-330px)]"
      aria-hidden="true"
    />
  );
}

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!listTeamSlugs().includes(slug)) notFound();

  const result = loadTeamFile(slug);

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-[1290px] px-4 py-8">
      <Link
        href="/"
        className="text-sm text-ink-muted underline underline-offset-2 outline-none hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        &larr; All teams
      </Link>

      {!result.ok ? (
        <>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink [text-wrap:balance]">
            {slug.toUpperCase()}
          </h1>
          <p className="mt-4 text-sm text-ink-muted">
            This team&apos;s data could not be loaded ({result.error}). The other teams are unaffected.
          </p>
        </>
      ) : (
        <>
          <TeamStructuredData teamLabel={result.data.teamLabel} slug={slug} />
          {/* Responsive header layout: a plain stack (unchanged from before)
              below the lg breakpoint. At lg+, everything here sits as a
              plain 320px-wide left-aligned column (`lg:w-[290px]` — a block
              element's default position is flush-left, no margin trick
              needed; vertical spacing between these blocks is completely
              unaffected) while the chart itself (deep inside
              TeamPageClient/PayrollChart) is `lg:absolute` within this
              `lg:relative` container, floating into the space on the right
              (100% - 360px, leaving a 40px gap after this 320px column). A
              CSS Grid with named rows was tried first and rejected: a grid
              item spanning multiple rows forces every spanned row to grow
              to share its height, which ballooned huge gaps between this
              short header content and the (much taller) chart's row span —
              this absolute-positioning approach has no such coupling, since
              the chart is removed from the sidebar's normal flow entirely.
              `lg:min-h-[980px]` keeps this container (and thus the page
              content below it) tall enough for the chart even though the
              chart no longer contributes to normal flow height. */}
          <div className="lg:relative lg:min-h-[980px]">
            <div className="min-w-0 lg:w-[290px]">
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink [text-wrap:balance]">
                {result.data.teamLabel}
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
            {(() => {
              const seasons = availableSeasonsFor(result.data);
              return seasons.length === 0 ? (
                <p className="mt-4 text-sm text-ink-muted lg:w-[290px]">
                  No season currently has both sourced cap charges and a published threshold table to draw against.
                </p>
              ) : (
                // useSearchParams (read inside TeamPageClient, for the season-range
                // state in the URL — spec §10) opts the page out of static prerendering
                // unless wrapped in Suspense; this fallback only ever flashes during
                // client-side navigation, not on first load. Kept scoped to just the
                // controls+chart (not the h1/last-updated block above), so the header text
                // never disappears/flashes during that transition — unchanged from before.
                <Suspense fallback={<PayrollChartFallback />}>
                  <TeamPageClient slug={slug} data={result.data} availableSeasons={seasons} />
                </Suspense>
              );
            })()}
          </div>
        </>
      )}
    </main>
  );
}
