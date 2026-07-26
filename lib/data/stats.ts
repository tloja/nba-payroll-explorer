import { listTeamSlugs, loadTeamFile } from './teams';
import type { Derivation } from '../types';

// Dataset-wide stats computed live from data/teams/*.json (server-only, fs-based —
// same reasoning as teams.ts) rather than hardcoded into page copy. Used by
// /methodology and /sources so the credibility pages describe the dataset as it
// actually is at read time instead of a snapshot that goes stale as ingestion
// re-runs and the estimated/sourced mix shifts.
export type DatasetStats = {
  teamCount: number;
  loadedTeamCount: number;
  failedSlugs: string[];
  chargeCount: number;
  derivationCounts: Record<Derivation, number>;
  estimatedTeamCount: number;
  sourceIds: string[];
  lastUpdatedAt: string | null;
};

const ZERO_DERIVATION_COUNTS: Record<Derivation, number> = {
  sourced: 0,
  computed: 0,
  estimated: 0,
  synthetic: 0,
};

export function computeDatasetStats(): DatasetStats {
  const slugs = listTeamSlugs();
  const results = slugs.map((slug) => loadTeamFile(slug));
  const loaded = results.flatMap((r) => (r.ok ? [r.data] : []));
  const failedSlugs = results.flatMap((r) => (r.ok ? [] : [r.slug]));

  const derivationCounts = { ...ZERO_DERIVATION_COUNTS };
  const sourceIds = new Set<string>();
  let chargeCount = 0;
  let estimatedTeamCount = 0;
  let lastUpdatedAt: string | null = null;

  for (const data of loaded) {
    let teamHasEstimated = false;
    for (const charge of data.capCharges) {
      chargeCount++;
      derivationCounts[charge.derivation]++;
      sourceIds.add(charge.sourceId);
      if (charge.derivation === 'estimated') teamHasEstimated = true;
      if (lastUpdatedAt === null || charge.retrievedAt > lastUpdatedAt) lastUpdatedAt = charge.retrievedAt;
    }
    if (teamHasEstimated) estimatedTeamCount++;
  }

  return {
    teamCount: slugs.length,
    loadedTeamCount: loaded.length,
    failedSlugs,
    chargeCount,
    derivationCounts,
    estimatedTeamCount,
    sourceIds: [...sourceIds].sort(),
    lastUpdatedAt,
  };
}
