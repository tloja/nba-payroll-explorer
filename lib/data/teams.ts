import fs from 'node:fs';
import path from 'node:path';
import type { Season } from '../types';
import type { TeamCapChargesFile } from '../verify/teamFile';
import { availableSeasonsFor } from './teamPayroll';

// Server-only (fs-based) team-file loaders. Kept out of lib/data/teamPayroll.ts
// (the pure helpers) so a client component can import the pure ones without
// pulling node:fs into the browser bundle.

const TEAMS_DIR = path.join(process.cwd(), 'data', 'teams');

export type TeamLoadResult =
  | { ok: true; slug: string; data: TeamCapChargesFile }
  | { ok: false; slug: string; error: string };

/** Lowercase team slugs, one per file in data/teams/ (e.g. "okc") — these are
 * the app's routing slugs, derived from the ingestion output itself rather
 * than a second hardcoded 30-team list. */
export function listTeamSlugs(): string[] {
  return fs
    .readdirSync(TEAMS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
    .sort();
}

/** Never throws — a malformed or missing team file must not take the league
 * view or the other 29 teams down with it (M4 requirement). */
export function loadTeamFile(slug: string): TeamLoadResult {
  try {
    const raw = fs.readFileSync(path.join(TEAMS_DIR, `${slug}.json`), 'utf-8');
    return { ok: true, slug, data: JSON.parse(raw) as TeamCapChargesFile };
  } catch (err) {
    return { ok: false, slug, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Every {slug, season} pair currently renderable at /team/[slug]/[season] —
 * shared by that route's generateStaticParams, the OG image route, and
 * sitemap.ts, rather than three copies of the same load-every-team-and-
 * intersect-seasons loop. */
export function listTeamSeasonPairs(): { slug: string; season: Season }[] {
  return listTeamSlugs().flatMap((slug) => {
    const result = loadTeamFile(slug);
    if (!result.ok) return [];
    return availableSeasonsFor(result.data).map((season) => ({ slug, season }));
  });
}
