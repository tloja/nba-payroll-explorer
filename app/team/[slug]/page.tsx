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
  // (TeamPageClient defaults `to`/`focus` to the last available season) —
  // same reasoning `pickLeagueSeason` (app/page.tsx) already uses.
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
  return <div className="mt-4 h-[520px] w-full animate-pulse rounded bg-[#f0efe9]" aria-hidden="true" />;
}

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!listTeamSlugs().includes(slug)) notFound();

  const result = loadTeamFile(slug);

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/" className="text-sm text-[#52514e] underline">
        &larr; All teams
      </Link>

      {!result.ok ? (
        <>
          <h1 className="mt-2 text-xl font-semibold">{slug.toUpperCase()}</h1>
          <p className="mt-4 text-sm text-[#52514e]">
            This team&apos;s data could not be loaded ({result.error}). The other teams are unaffected.
          </p>
        </>
      ) : (
        <>
          <TeamStructuredData teamLabel={result.data.teamLabel} slug={slug} />
          <h1 className="mt-2 text-xl font-semibold">{result.data.teamLabel}</h1>
          {(() => {
            const lastUpdated = lastUpdatedFor(result.data);
            return lastUpdated ? (
              <p className="mt-1 text-xs text-[#52514e]">
                Data last updated {formatRetrievedAt(lastUpdated)}. See{' '}
                <Link href="/methodology" className="underline">
                  methodology
                </Link>{' '}
                and{' '}
                <Link href="/sources" className="underline">
                  sources
                </Link>
                .
              </p>
            ) : null;
          })()}
          {(() => {
            const seasons = availableSeasonsFor(result.data);
            return seasons.length === 0 ? (
              <p className="mt-4 text-sm text-[#52514e]">
                No season currently has both sourced cap charges and a published threshold table to draw against.
              </p>
            ) : (
              // useSearchParams (read inside TeamPageClient, for the season-range/focus
              // state in the URL — spec §10) opts the page out of static prerendering
              // unless wrapped in Suspense; this fallback only ever flashes during
              // client-side navigation, not on first load.
              <Suspense fallback={<PayrollChartFallback />}>
                <TeamPageClient slug={slug} data={result.data} availableSeasons={seasons} />
              </Suspense>
            );
          })()}
        </>
      )}
    </main>
  );
}
