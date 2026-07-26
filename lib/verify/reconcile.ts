import type { CapCharge, Season } from '../types';

export type Totals = { capHit: number; taxHit: number; apronHit: number };

const ZERO_TOTALS: Totals = { capHit: 0, taxHit: 0, apronHit: 0 };

// Reconciliation tolerance (spec §3/§9: "±$1"). Whole-dollar rounding across
// many charges can drift by a dollar or two without indicating a real bug.
const TOLERANCE_DOLLARS = 1;

export function sumCharges(charges: CapCharge[]): Totals {
  return charges.reduce(
    (acc, c) => ({
      capHit: acc.capHit + c.capHit,
      taxHit: acc.taxHit + c.taxHit,
      apronHit: acc.apronHit + c.apronHit,
    }),
    ZERO_TOTALS,
  );
}

export type FieldResult = { field: keyof Totals; actual: number; expected: number; diff: number; ok: boolean };

export type ReconciliationResult = {
  season: Season;
  ok: boolean;
  fields: FieldResult[];
};

export function reconcile(season: Season, charges: CapCharge[], expected: Totals): ReconciliationResult {
  const actual = sumCharges(charges);
  const fields = (Object.keys(expected) as (keyof Totals)[]).map((field) => {
    const diff = actual[field] - expected[field];
    return { field, actual: actual[field], expected: expected[field], diff, ok: Math.abs(diff) <= TOLERANCE_DOLLARS };
  });

  return { season, ok: fields.every((f) => f.ok), fields };
}
