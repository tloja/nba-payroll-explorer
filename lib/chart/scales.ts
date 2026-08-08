import { scaleBand, scaleLinear } from 'd3-scale';
import type { Season, SeasonThresholds } from '../types';
import type { SeasonStack } from './stack';

export type PlotDimensions = {
  width: number;
  height: number;
};

/** Band scale across seasons, left to right in season order. */
export function buildXScale(seasons: Season[], width: number) {
  // paddingInner 0.6151 (not a round number): solved to give each bar ~10%
  // more width than the previous 0.66, holding paddingOuter fixed — see
  // NOTES.md for the derivation. Trades back part of the inter-bar gap
  // that same NOTES.md entry just widened (~9% narrower), which is an
  // acceptable tradeoff now that calloutText() abbreviates long names to
  // initials instead of needing raw truncation width to fall back on.
  return scaleBand<Season>().domain(seasons).range([0, width]).paddingInner(0.6151).paddingOuter(0.1);
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
