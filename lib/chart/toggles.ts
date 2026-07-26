import type { CapCharge, Season, SeasonThresholds } from '../types';
import type { SeasonStack } from './stack';

// The toggle set from spec §6. One object, not four loose props, so URL
// state (TeamPageClient) and chart rendering (PayrollChart) can't drift
// apart from each other — see NOTES.md M5 entry.
export type PayrollBasis = 'cap' | 'tax' | 'apron';
export type DollarMode = 'absolute' | 'percent';

export type ChartToggles = {
  basis: PayrollBasis;
  includeDeadMoneyAndHolds: boolean;
  dollarMode: DollarMode;
  guaranteedOnly: boolean;
};

export const DEFAULT_TOGGLES: ChartToggles = {
  basis: 'cap',
  includeDeadMoneyAndHolds: true,
  dollarMode: 'absolute',
  guaranteedOnly: false,
};

const HOLD_CHARGE_TYPES = new Set(['dead_money', 'cap_hold', 'draft_hold']);

/** Drops dead-money/hold charge types entirely when the toggle excludes them. */
export function applyChargeFilters(charges: CapCharge[], toggles: ChartToggles): CapCharge[] {
  if (toggles.includeDeadMoneyAndHolds) return charges;
  return charges.filter((c) => !HOLD_CHARGE_TYPES.has(c.chargeType));
}

/**
 * The dollar amount a charge contributes to the stack under the current
 * toggles: which of capHit/taxHit/apronHit (basis), reduced to just the
 * guaranteed portion when guaranteedOnly is on. A `guaranteeStatus: 'none'`
 * charge contributes 0 under guaranteedOnly — callers should drop it from
 * the entity order/segments entirely rather than render a zero-height
 * segment (see `selectableCharges`).
 */
export function selectAmount(charge: CapCharge, toggles: ChartToggles): number {
  const hit =
    toggles.basis === 'cap' ? charge.capHit : toggles.basis === 'tax' ? charge.taxHit : charge.apronHit;

  if (!toggles.guaranteedOnly) return hit;

  if (charge.guaranteeStatus === 'full') return hit;
  if (charge.guaranteeStatus === 'none') return 0;
  // 'partial': the guaranteed portion is a single dollar figure independent
  // of basis (the schema carries one guaranteedAmount, not a per-basis
  // split) — never let it exceed the basis hit itself.
  return Math.min(charge.guaranteedAmount ?? 0, hit);
}

/**
 * Charges eligible to appear in the stack at all under the current toggles:
 * hold/dead-money exclusion, plus dropping any charge whose guaranteedOnly
 * amount resolves to exactly 0 (a 0-height segment has nothing to show and
 * would otherwise become a spurious "$0" callout).
 */
export function selectableCharges(charges: CapCharge[], toggles: ChartToggles): CapCharge[] {
  return applyChargeFilters(charges, toggles).filter((c) => selectAmount(c, toggles) > 0);
}

/**
 * Percent-of-that-season's-cap transform, applied only for rendering/scale
 * purposes — never touches the underlying CapCharge or SeasonThresholds
 * records (those stay real, sourced dollars per CLAUDE.md's provenance
 * rules). Produces transient derived copies with the same shape so
 * buildYScale/bandOverages/labels don't need to know about units at all.
 */
export function toDisplayThresholds(thresholds: SeasonThresholds[], mode: DollarMode): SeasonThresholds[] {
  if (mode === 'absolute') return thresholds;
  return thresholds.map((t) => {
    const scale = 100 / t.salaryCap;
    return {
      ...t,
      salaryCap: t.salaryCap * scale,
      minimumTeamSalary: t.minimumTeamSalary * scale,
      taxLevel: t.taxLevel * scale,
      firstApron: t.firstApron * scale,
      secondApron: t.secondApron * scale,
    };
  });
}

/** Same percent-of-cap transform applied to an already-stacked season, keyed by that season's own cap. */
export function toDisplayStack(stack: SeasonStack, thresholds: SeasonThresholds, mode: DollarMode): SeasonStack {
  if (mode === 'absolute') return stack;
  const scale = 100 / thresholds.salaryCap;
  return {
    ...stack,
    total: stack.total * scale,
    segments: stack.segments.map((seg) => ({ ...seg, bottom: seg.bottom * scale, top: seg.top * scale })),
  };
}

export function thresholdsBySeasonMap(thresholds: SeasonThresholds[]): Map<Season, SeasonThresholds> {
  return new Map(thresholds.map((t) => [t.season, t]));
}
