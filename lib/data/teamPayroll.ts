import type { CapCharge, Season, TeamPayrollData } from '../types';
import type { TeamCapChargesFile } from '../verify/teamFile';
import { SEASON_THRESHOLDS, thresholdsForSeason } from '../../data/thresholds';

/**
 * Seasons this team can actually render: it has sourced cap charges for the
 * season AND the canonical threshold table (data/thresholds.ts) has cap/tax/
 * apron figures for it. Real ingested data currently runs 2026-27 through as
 * far as 2031-32 for some teams, but data/thresholds.ts only carries the two
 * seasons spec §2 gives directly (2025-26, 2026-27) — extending it with
 * projected out-year figures is a separate decision for a later session, not
 * this one, so seasons past what the threshold table covers are excluded
 * rather than drawn against thresholds that don't exist.
 *
 * Pure (no fs) so it can be imported from client components (the season
 * selector) without pulling node:fs into the browser bundle — see
 * lib/data/teams.ts for the fs-based loaders this is split out from.
 */
export function availableSeasonsFor(data: TeamCapChargesFile): Season[] {
  const chargeSeasons = new Set(data.capCharges.map((c) => c.season));
  return SEASON_THRESHOLDS.map((t) => t.season)
    .filter((season) => chargeSeasons.has(season))
    .sort();
}

/** Composes a team's ingestion output with the canonical thresholds into the
 * shape PayrollChart renders, restricted to `seasons`. */
export function toPayrollData(data: TeamCapChargesFile, seasons: Season[]): TeamPayrollData {
  const seasonSet = new Set(seasons);
  return {
    teamId: data.teamId,
    teamLabel: data.teamLabel,
    thresholds: seasons.map((s) => thresholdsForSeason(s)!),
    capCharges: data.capCharges.filter((c) => seasonSet.has(c.season)),
  };
}

/**
 * "Last updated" for a team page (spec §8): the most recent `retrievedAt`
 * across that team's own cap charges — never build time. ISO 8601 strings
 * compare correctly with plain string ordering, so no Date parsing is
 * needed to find the max. Pure (no fs), same reasoning as the rest of this
 * file: usable from the server-rendered team page without pulling node:fs
 * into a client bundle.
 */
export function lastUpdatedFor(data: TeamCapChargesFile): string | null {
  if (data.capCharges.length === 0) return null;
  return data.capCharges.reduce(
    (max: string, c: CapCharge) => (c.retrievedAt > max ? c.retrievedAt : max),
    data.capCharges[0].retrievedAt,
  );
}
