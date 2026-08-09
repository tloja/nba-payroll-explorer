import { listTeamSlugs, loadTeamFile } from '../lib/data/teams';
import type { TeamCapChargesFile } from '../lib/verify/teamFile';
import { SEASON_THRESHOLDS } from '../data/thresholds';
import { LeagueOverview } from '../components/league/LeagueOverview';
import type { Season } from '../lib/types';

/** Most recent *non-projected* season with both sourced cap charges (from at
 * least one team) and a published threshold table (data/thresholds.ts) to
 * measure it against — the league view needs one fixed season shared by all
 * 30 teams. No season toggle yet (M4 scope); this tracks forward
 * automatically once a later session extends the threshold table.
 *
 * Projected seasons (M11: 2027-28) are deliberately excluded here, even
 * though they satisfy both conditions above. A projected season is sparse by
 * design — unresolved options, unsigned picks, and expired contracts with no
 * successor all mean "real" — a team with several such gaps would understate
 * its payroll and read as far under the aprons than it actually is. That
 * incompleteness is fine to show on a single team's own chart (labeled,
 * dashed, explained in /methodology) but would misrepresent the league-wide
 * "who's over which line" comparison this view exists to make. Confirmed
 * with the user before implementing (M11): league view stays on 2026-27
 * rather than following the team page to 2027-28. */
function pickLeagueSeason(loaded: { data: TeamCapChargesFile }[]): Season | null {
  const seasonsWithCharges = new Set(loaded.flatMap((r) => r.data.capCharges.map((c) => c.season)));
  const candidates = [...SEASON_THRESHOLDS]
    .filter((t) => !t.isProjected)
    .map((t) => t.season)
    .sort()
    .reverse();
  return candidates.find((s) => seasonsWithCharges.has(s)) ?? null;
}

export default function HomePage() {
  const results = listTeamSlugs().map((slug) => ({ slug, result: loadTeamFile(slug) }));
  const loaded = results.flatMap((r) => (r.result.ok ? [{ slug: r.slug, data: r.result.data }] : []));
  const failedSlugs = results.filter((r) => !r.result.ok).map((r) => r.slug);

  const leagueSeason = pickLeagueSeason(loaded);

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-ink [text-wrap:balance]">NBA Payroll Explorer</h1>
      <p className="mb-6 mt-1 text-sm text-ink-muted">
        All 30 teams{leagueSeason ? `, ${leagueSeason}` : ''}, sorted by total payroll, against the salary cap, tax
        line, and both apron thresholds.
      </p>

      {leagueSeason ? (
        <LeagueOverview season={leagueSeason} teams={loaded} />
      ) : (
        <p className="text-sm text-ink-muted">
          No season currently has both sourced cap charges and a published threshold table to measure it against.
        </p>
      )}

      {failedSlugs.length > 0 && (
        <p className="mt-6 text-xs text-ink-muted">
          {failedSlugs.length} team{failedSlugs.length === 1 ? '' : 's'} could not be loaded and{' '}
          {failedSlugs.length === 1 ? 'is' : 'are'} omitted above: {failedSlugs.join(', ')}.
        </p>
      )}
    </main>
  );
}
