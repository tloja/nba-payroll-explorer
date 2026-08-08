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
  // 2027-28 is a projection (M11, spec §11): no NBA announcement exists yet
  // for this season, and nothing in lib/cba/ documents a growth-rate
  // constant to reuse, so this applies the spec's own stated ~10% assumption
  // to every 2026-27 figure. Computed once via exact integer arithmetic
  // (×11÷10, which divides evenly since every 2026-27 figure already ends in
  // '000' — no floats, no rounding) and hardcoded here, same convention as
  // 2025-26's hand-computed minimumTeamSalary above. isProjected: true is
  // what drives the chart's dashed threshold lines and "(projected)" labels
  // — see /methodology for the full explanation.
  {
    season: '2027-28',
    isProjected: true,
    salaryCap: 181_457_100,
    minimumTeamSalary: 163_311_390,
    taxLevel: 220_470_800,
    firstApron: 229_916_500,
    secondApron: 243_854_600,
  },
];

export function thresholdsForSeason(season: Season): SeasonThresholds | undefined {
  return SEASON_THRESHOLDS.find((t) => t.season === season);
}
