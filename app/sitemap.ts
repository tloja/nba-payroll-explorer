import type { MetadataRoute } from 'next';
import { SITE_URL } from '../lib/site';
import { listTeamSlugs, listTeamSeasonPairs, loadTeamFile } from '../lib/data/teams';
import { lastUpdatedFor } from '../lib/data/teamPayroll';

// Required for `output: 'export'` — without this, Next can't confirm this
// route has no runtime dependency on the request and refuses to export it.
export const dynamic = 'force-static';

// Static, non-team pages actually built (spec §6/§11) — /compare and /player
// don't exist yet (M8's scope is M7's public surface + team/season routes,
// not new routes), so they're correctly absent here rather than 404 links in
// the sitemap.
const STATIC_PAGES: { path: string; priority: number }[] = [
  { path: '/', priority: 1 },
  { path: '/methodology', priority: 0.5 },
  { path: '/sources', priority: 0.5 },
  { path: '/glossary', priority: 0.5 },
  { path: '/corrections', priority: 0.3 },
  { path: '/about', priority: 0.3 },
  { path: '/privacy', priority: 0.2 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const staticEntries: MetadataRoute.Sitemap = STATIC_PAGES.map(({ path, priority }) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: 'monthly',
    priority,
  }));

  const teamEntries: MetadataRoute.Sitemap = listTeamSlugs().flatMap((slug) => {
    const result = loadTeamFile(slug);
    if (!result.ok) return [];
    const lastUpdated = lastUpdatedFor(result.data);
    return [
      {
        url: `${SITE_URL}/team/${slug}`,
        lastModified: lastUpdated ?? undefined,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      },
    ];
  });

  const seasonEntries: MetadataRoute.Sitemap = listTeamSeasonPairs().map(({ slug, season }) => {
    const result = loadTeamFile(slug);
    const lastUpdated = result.ok ? lastUpdatedFor(result.data) : null;
    return {
      url: `${SITE_URL}/team/${slug}/${season}`,
      lastModified: lastUpdated ?? undefined,
      changeFrequency: 'weekly',
      priority: 0.6,
    };
  });

  return [...staticEntries, ...teamEntries, ...seasonEntries];
}
