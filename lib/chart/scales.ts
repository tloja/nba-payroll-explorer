import { scaleBand, scaleLinear } from 'd3-scale';
import type { Season, SeasonThresholds } from '../types';
import type { SeasonStack } from './stack';

export type PlotDimensions = {
  width: number;
  height: number;
};

/** Band scale across seasons, left to right in season order. */
export function buildXScale(seasons: Season[], width: number) {
  // paddingInner 0.4514 (not a round number): solved so a bar's own width
  // clears lib/chart/labels.ts's inside-label width check
  // (label.length * APPROX_CHAR_WIDTH + INSIDE_LABEL_HORIZONTAL_PADDING)
  // for 90% of real NBA player names — raised from an earlier majority-only
  // (59.3%) target at 95px, per an explicit follow-up ask. Same measured
  // dataset as that earlier pass (unique player labels across all 30
  // teams' capCharges, data/teams/*.json): 16 characters or fewer covers
  // 90.5% of players, the first bracket to clear 90% (17 chars jumps to
  // 95.4%, but wasn't asked for and costs more gap than this ask calls
  // for). 113.6px (16*6.6+8) is the exact breakeven; 115px was chosen as
  // the target bandwidth, a few px of headroom in the same 90.5% bracket.
  // This only decides whether a segment is *wide* enough to earn an inside
  // label — a segment still separately needs enough height (spec §5 rule
  // 1) regardless of this value.
  //
  // Solved algebraically the same way as the majority-only pass, from the
  // standard d3 scaleBand formulas, holding paddingOuter at 0.1 and using
  // this chart's own real plotWidth (366.56px, measured at a 1440px-
  // viewport render): plugging in the 115px target gives paddingInner
  // 0.4514. Verified after the fact too: a live render's bar `rect` came
  // back with `width="115"` exactly.
  //
  // Real cost, not free: at this width the gap between the two bars drops
  // to ~95px (was ~131px at the majority-only target, ~157px before any of
  // this session's spacing changes), which leaves noticeably less room for
  // whatever's left in the callouts — the ~10% of names that still don't
  // fit inside, dead money/holds, and anything whose segment is tall
  // enough for its width but too short to qualify at all. See NOTES.md for
  // what that looks like in practice.
  return scaleBand<Season>().domain(seasons).range([0, width]).paddingInner(0.4514).paddingOuter(0.1);
}

/**
 * Domain ceiling shared by every dollar-axis scale in the app: the greatest
 * of the given totals and secondApron values, with 8% headroom so the second
 * apron line never sits flush against the plot edge. Pulled out of
 * `buildYScale` so the league view's horizontal dollar scale (money on x, not
 * y) can compute the same ceiling without re-deriving the formula.
 */
export function dollarDomainCeiling(totals: number[], secondApronValues: number[]): number {
  const totalMax = Math.max(0, ...totals);
  const apronMax = Math.max(0, ...secondApronValues);
  return Math.max(totalMax, apronMax) * 1.08;
}

/** Linear dollar scale, y=0 at the bottom. See `dollarDomainCeiling` for the domain. */
export function buildYScale(
  stacks: SeasonStack[],
  thresholds: SeasonThresholds[],
  height: number,
) {
  const domainMax = dollarDomainCeiling(
    stacks.map((s) => s.total),
    thresholds.map((t) => t.secondApron),
  );
  return scaleLinear().domain([0, domainMax]).nice().range([height, 0]);
}
