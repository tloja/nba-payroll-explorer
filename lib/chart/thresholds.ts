import type { SeasonThresholds } from '../types';

/**
 * Apron thresholds are compared against apronHit-derived team totals only
 * (CLAUDE.md). In this M1 fixture capHit === taxHit === apronHit for every
 * charge (spec §2 explicitly allows v1 to set all three equal), so the
 * stack's own total doubles as the apron payroll total — but this function
 * takes the total as an argument rather than assuming that, so a future
 * milestone that diverges the three hits doesn't have to touch this code,
 * only what it's called with.
 */
export type ThresholdBand = {
  key: 'cap' | 'tax' | 'apron1' | 'apron2';
  /** Dollar amount of the team's total strictly above this threshold, 0 if under. */
  overage: number;
};

export function bandOverages(total: number, t: SeasonThresholds): ThresholdBand[] {
  return [
    { key: 'cap', overage: Math.max(0, total - t.salaryCap) },
    { key: 'tax', overage: Math.max(0, total - t.taxLevel) },
    { key: 'apron1', overage: Math.max(0, total - t.firstApron) },
    { key: 'apron2', overage: Math.max(0, total - t.secondApron) },
  ];
}

/**
 * A threshold flagged `isProjected` must never render with the same visual
 * confidence as a real one (CLAUDE.md, spec §2: "render dashed... never
 * present a guess at full confidence"). This loosens whatever dash pattern a
 * threshold line already uses — including `undefined` (solid), which becomes
 * an even dash — by scaling it up, rather than replacing it with one fixed
 * "projected" pattern. That keeps a projected line identifiable by *type*
 * (cap vs. tax vs. apron) via its dash's shape, just visibly looser than its
 * real counterpart, instead of making every projected line indistinguishable
 * from every other projected line.
 */
export function projectedDash(dash: string | undefined, isProjected: boolean): string | undefined {
  if (!isProjected) return dash;
  if (!dash) return '5,5';
  return dash
    .split(',')
    .map((n) => Number(n) * 2.5)
    .join(',');
}
