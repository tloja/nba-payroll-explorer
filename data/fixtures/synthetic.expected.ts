import type { Season } from '../../lib/types';
import type { Totals } from '../../lib/verify/reconcile';

// Independently hand-summed expected totals for the synthetic fixture, used
// only to smoke-test scripts/verify.ts. In production (M3+) this "expected"
// side comes from a source's published team total, checked against the
// itemized CapCharge[] built by the ingestion adapter — the point is
// catching drift between the two, not auditing this fixture's own realism.
export const SYNTHETIC_EXPECTED_TOTALS: Record<Season, Totals> = {
  '2025-26': { capHit: 208_850_000, taxHit: 208_850_000, apronHit: 208_850_000 },
  '2026-27': { capHit: 200_950_000, taxHit: 200_950_000, apronHit: 200_950_000 },
};
