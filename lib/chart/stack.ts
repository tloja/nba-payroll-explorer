import type { CapCharge, Season } from '../types';

export type StackSegment = {
  /** Stable across seasons: playerId when present, else the charge id. */
  entityId: string;
  charge: CapCharge;
  /** Cumulative dollars below this segment within its season's stack. */
  bottom: number;
  /** bottom + this segment's stacked amount (capHit by default, see `getAmount`). */
  top: number;
};

export type SeasonStack = {
  season: Season;
  segments: StackSegment[];
  total: number;
};

function entityKey(charge: CapCharge): string {
  return charge.playerId ?? charge.id;
}

/**
 * One fixed vertical order, shared by every season's bar, so a given player
 * occupies the same band across bars and horizontal tracking is possible
 * (spec §5 — never re-sort per season).
 *
 * Ordered by the focus season's amount descending (capHit by default — see
 * `getAmount`). Entities that don't appear in the focus season (left before
 * it / arrive after it) are appended, ordered by their own largest amount
 * across whatever seasons they do appear in, so every entity still gets a
 * defined, stable slot.
 *
 * `getAmount` defaults to `capHit` so every existing caller/test is
 * unaffected; M5's toggle set (payroll basis, guaranteed-only) passes a
 * toggle-aware accessor instead of duplicating this function.
 */
export function buildStackOrder(
  charges: CapCharge[],
  focusSeason: Season,
  getAmount: (charge: CapCharge) => number = (c) => c.capHit,
): string[] {
  const byEntity = new Map<string, CapCharge[]>();
  for (const charge of charges) {
    const key = entityKey(charge);
    const list = byEntity.get(key);
    if (list) list.push(charge);
    else byEntity.set(key, [charge]);
  }

  const inFocus: string[] = [];
  const outOfFocus: string[] = [];
  for (const [key, entityCharges] of byEntity) {
    const focusCharge = entityCharges.find((c) => c.season === focusSeason);
    if (focusCharge) inFocus.push(key);
    else outOfFocus.push(key);
  }

  const maxAmount = (key: string) =>
    Math.max(...(byEntity.get(key) ?? []).map(getAmount));

  inFocus.sort((a, b) => maxAmount(b) - maxAmount(a));
  outOfFocus.sort((a, b) => maxAmount(b) - maxAmount(a));

  return [...inFocus, ...outOfFocus];
}

/**
 * Stacks one season's charges in the given fixed order, skipping entities
 * absent that season. `getAmount` defaults to `capHit`, same rationale as
 * `buildStackOrder`.
 */
export function stackSeason(
  charges: CapCharge[],
  season: Season,
  order: string[],
  getAmount: (charge: CapCharge) => number = (c) => c.capHit,
): SeasonStack {
  const bySeason = charges.filter((c) => c.season === season);
  const byEntity = new Map(bySeason.map((c) => [entityKey(c), c]));

  const segments: StackSegment[] = [];
  let cursor = 0;
  for (const entityId of order) {
    const charge = byEntity.get(entityId);
    if (!charge) continue;
    const amount = getAmount(charge);
    const bottom = cursor;
    const top = cursor + amount;
    segments.push({ entityId, charge, bottom, top });
    cursor = top;
  }

  return { season, segments, total: cursor };
}
