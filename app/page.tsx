import { listTeamSlugs, loadTeamFile } from '../lib/data/teams';
import type { TeamCapChargesFile } from '../lib/verify/teamFile';
import { SEASON_THRESHOLDS } from '../data/thresholds';
import { LeagueOverview } from '../components/league/LeagueOverview';
import type { Season } from '../lib/types';

/** Most recent season with both sourced cap charges (from at least one team)
 * and a published threshold table (data/thresholds.ts) to measure it
 * against — the league view needs one fixed season shared by all 30 teams.
 * No season toggle yet (M4 scope); this tracks forward automatically once a
 * later session extends the threshold table. */
function pickLeagueSeason(loaded: { data: TeamCapChargesFile }[]): Season | null {
  const seasonsWithCharges = new Set(loaded.flatMap((r) => r.data.capCharges.map((c) => c.season)));
  const candidates = [...SEASON_THRESHOLDS].map((t) => t.season).sort().reverse();
  return candidates.find((s) => seasonsWithCharges.has(s)) ?? null;
}

export default function HomePage() {
  const results = listTeamSlugs().map((slug) => ({ slug, result: loadTeamFile(slug) }));
  const loaded = results.flatMap((r) => (r.result.ok ? [{ slug: r.slug, data: r.result.data }] : []));
  const failedSlugs = results.filter((r) => !r.result.ok).map((r) => r.slug);

  const leagueSeason = pickLeagueSeason(loaded);

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-xl font-semibold">NBA Payroll Explorer</h1>
      <p className="mb-6 text-sm text-[#52514e]">
        All 30 teams{leagueSeason ? `, ${leagueSeason}` : ''}, sorted by total payroll, against the salary cap, tax
        line, and both apron thresholds.
      </p>

      {leagueSeason ? (
        <LeagueOverview season={leagueSeason} teams={loaded} />
      ) : (
        <p className="text-sm text-[#52514e]">
          No season currently has both sourced cap charges and a published threshold table to measure it against.
        </p>
      )}

      {failedSlugs.length > 0 && (
        <p className="mt-6 text-xs text-[#52514e]">
          {failedSlugs.length} team{failedSlugs.length === 1 ? '' : 's'} could not be loaded and{' '}
          {failedSlugs.length === 1 ? 'is' : 'are'} omitted above: {failedSlugs.join(', ')}.
        </p>
      )}
    </main>
  );
}
