import { scaleBand, scaleLinear } from 'd3-scale';
import type { Season, SeasonThresholds } from '../types';
import type { SeasonStack } from './stack';

export type PlotDimensions = {
  width: number;
  height: number;
};

/** Band scale across seasons, left to right in season order. */
export function buildXScale(seasons: Season[], width: number) {
  // paddingInner 0.5170 (not a round number): bandwidth target raised again,
  // from 130px to 163px, so "Shai Gilgeous-Alexander" (23 characters --
  // longer than Karl-Anthony Towns, the previous target) clears the
  // inside-label width check (23*6.6+8 = 159.8px required; 163px leaves a
  // few px of headroom, same convention as every prior pass). Note this
  // still isn't the single longest real name in the dataset -- "Nickeil
  // Alexander-Walker" is 24 characters, one longer than SGA -- but wasn't
  // what was asked for this round; revisit the target/method below if a
  // future ask names him specifically.
  //
  // Grew the container again rather than trading gap/margin width, same
  // approach as the last two passes: app/team/[slug]/page.tsx and
  // .../[season]/page.tsx -- `max-w-[1220px]` -> `max-w-[1290px]`, solved
  // backwards from the plotWidth this bandwidth needs. Sidebar/gap (290px
  // + 40px) untouched again. Chart column grew 858px -> 928px (live-
  // measured). Both marginLeft and marginRight are now clamped at their
  // caps (MARGIN.leftMax 170px, MARGIN.rightMax 190px in
  // components/chart/PayrollChart.tsx) rather than their usual 0.2/0.22
  // fractions -- past a certain container width, further growth stops
  // feeding the margins at all and goes entirely into plotWidth (bar +
  // gap), which is exactly what this pass needed.
  //
  // Solved the same way as every prior pass: standard d3 scaleBand
  // formulas, holding paddingOuter at 0.1, plugged in the real plotWidth
  // (568px = 928 - 170 - 190) and the 163px bandwidth target. Verified
  // after the fact: a live render's bar `rect` came back `width="163"`
  // exactly, with the resulting gap (174.5px) and the clamped marginRight
  // (190px) both still clearing the 164px callout-text target from two
  // passes ago with room to spare.
  return scaleBand<Season>().domain(seasons).range([0, width]).paddingInner(0.5170).paddingOuter(0.1);
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
