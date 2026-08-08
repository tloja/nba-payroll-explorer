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
 * Ordered by each entity's own largest amount (capHit by default — see
 * `getAmount`) across whichever seasons it actually appears in — no
 * favoritism toward presence in any one particular season. An earlier
 * version anchored the sort to a single "focus" season (originally a
 * user-facing selector, spec §5's literal reading; removed as a control —
 * see NOTES.md) and treated every entity absent from *that* season as a
 * second-class group appended after everyone present in it, regardless of
 * amount. That silently broke as soon as the focus season was hardcoded to
 * the range's last season: a player whose contract simply ends before the
 * last season (e.g. an expiring deal) would get shoved into the "absent"
 * group and rendered above cheaper players still active in that season,
 * even on a bar where the expiring player was clearly present and clearly
 * the largest amount on the roster (found via a real bug report — Golden
 * State's Stephen Curry, Jimmy Butler, and Draymond Green, its three
 * biggest 2026-27 cap hits, none of them extending to 2027-28, all three
 * rendering in the middle of the 2026-27 bar instead of the bottom). Global
 * max-amount sorting isn't a perfect guarantee for every season either —
 * two entities both present in some season could theoretically still swap
 * relative order if one has a much larger amount in a *different* season —
 * but it's a strictly better default with no dedicated season to favor,
 * and it fixes exactly the failure mode above (the common case: someone's
 * deal simply doesn't reach the last season shown).
 *
 * `getAmount` defaults to `capHit` so every existing caller/test is
 * unaffected; M5's toggle set (payroll basis, guaranteed-only) passes a
 * toggle-aware accessor instead of duplicating this function.
 */
export function buildStackOrder(
  charges: CapCharge[],
  getAmount: (charge: CapCharge) => number = (c) => c.capHit,
): string[] {
  const byEntity = new Map<string, CapCharge[]>();
  for (const charge of charges) {
    const key = entityKey(charge);
    const list = byEntity.get(key);
    if (list) list.push(charge);
    else byEntity.set(key, [charge]);
  }

  const maxAmount = (key: string) =>
    Math.max(...(byEntity.get(key) ?? []).map(getAmount));

  return [...byEntity.keys()].sort((a, b) => maxAmount(b) - maxAmount(a));
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
