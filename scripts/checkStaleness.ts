// Standalone staleness alarm (spec §8/§4): fails if the freshest `retrievedAt`
// across every team's ingested data is more than 72 hours old. This is
// deliberately separate from the ingestion job itself (scripts/orchestrate.ts)
// and from scripts/verify.ts's reconciliation check — it exists specifically
// to catch the case where the scheduled ingestion Action stops running
// (disabled, deleted, silently erroring in a way that still exits 0) rather
// than actively failing. Reads the same on-disk data/teams/ files the site
// itself reads, not git history, so it reflects what's actually served.

import { listTeamSlugs, loadTeamFile } from '../lib/data/teams';
import { lastUpdatedFor } from '../lib/data/teamPayroll';

const STALE_AFTER_MS = 72 * 60 * 60 * 1000;

function main(): number {
  const slugs = listTeamSlugs();
  if (slugs.length === 0) {
    console.error('No team data files found in data/teams/ — nothing to check.');
    return 1;
  }

  let mostRecent: string | null = null;
  const missing: string[] = [];

  for (const slug of slugs) {
    const result = loadTeamFile(slug);
    if (!result.ok) {
      missing.push(slug);
      continue;
    }
    const updated = lastUpdatedFor(result.data);
    if (updated && (!mostRecent || updated > mostRecent)) {
      mostRecent = updated;
    }
  }

  if (missing.length > 0) {
    console.warn(`Warning: ${missing.length} team file(s) failed to load: ${missing.join(', ')}`);
  }

  if (!mostRecent) {
    console.error('No retrievedAt timestamp found across any team file.');
    return 1;
  }

  const ageMs = Date.now() - new Date(mostRecent).getTime();
  const ageHours = (ageMs / (60 * 60 * 1000)).toFixed(1);

  console.log(`Most recent retrievedAt across all ${slugs.length} teams: ${mostRecent} (${ageHours}h ago)`);

  if (ageMs > STALE_AFTER_MS) {
    console.error(
      `STALE: freshest data is ${ageHours}h old, past the 72h threshold. ` +
        `The scheduled ingestion Action may have stopped running — check its run history.`,
    );
    return 1;
  }

  console.log('OK: data is within the 72h freshness window.');
  return 0;
}

process.exit(main());
