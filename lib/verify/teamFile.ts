import type { CapCharge, Season } from '../types';
import { reconcile, type ReconciliationResult, type Totals } from './reconcile';

// Shape of a single team's on-disk ingestion output (data/teams/<slug>.json).
export type TeamCapChargesFile = {
  teamId: string;
  teamLabel: string;
  capCharges: CapCharge[];
  reportedTotals: { season: Season; total: number }[];
};

// Reconciles a team's itemized capCharges against the source page's own
// reported per-season total (spec §3/§9), one result per season present in
// `reportedTotals`. Pure — no fs, no console — so both the `verify.ts` CLI
// and `orchestrate.ts`'s own per-team run summary reuse the exact same check
// rather than each re-implementing it.
export function reconcileTeamFile(data: TeamCapChargesFile): ReconciliationResult[] {
  return data.reportedTotals.map(({ season, total }) => {
    const expected: Totals = { capHit: total, taxHit: total, apronHit: total };
    const charges = data.capCharges.filter((c) => c.season === season);
    return reconcile(season, charges, expected);
  });
}
