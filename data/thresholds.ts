import type { Season, SeasonThresholds } from '../lib/types';

// Canonical, versioned threshold table (spec §2). These are the NBA's
// announced cap/tax/apron figures, not fixture data — every team page reads
// from here rather than duplicating values per team. 2025-26 minimumTeamSalary
// isn't published directly in the spec; it's computed from the documented CBA
// formula (90% of that season's cap), which matches the ratio the given
// 2026-27 figure implies (148,465,000 / 164,961,000 = 0.9000).
export const SEASON_THRESHOLDS: SeasonThresholds[] = [
  {
    season: '2025-26',
    isProjected: false,
    salaryCap: 154_647_000,
    minimumTeamSalary: 139_182_300,
    taxLevel: 187_895_000,
    firstApron: 195_945_000,
    secondApron: 207_824_000,
  },
  {
    season: '2026-27',
    isProjected: false,
    salaryCap: 164_961_000,
    minimumTeamSalary: 148_465_000,
    taxLevel: 200_428_000,
    firstApron: 209_015_000,
    secondApron: 221_686_000,
  },
];

export function thresholdsForSeason(season: Season): SeasonThresholds | undefined {
  return SEASON_THRESHOLDS.find((t) => t.season === season);
}
