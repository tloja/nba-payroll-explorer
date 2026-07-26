// Asserts a team/season's itemized CapCharges reconcile against an
// independently known total, within ±$1, and fails loudly on drift (spec §3,
// §9). Runs against the synthetic fixture as its M2 smoke test; M3's real
// ingestion adapters reuse `reconcile`/`sumCharges` from lib/verify/reconcile.ts
// against each team's published total.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { CapCharge, Season, SyntheticFixtureFile } from '../lib/types';
import { reconcile, type Totals } from '../lib/verify/reconcile';
import { reconcileTeamFile, type TeamCapChargesFile } from '../lib/verify/teamFile';
import fixtureData from '../data/fixtures/synthetic.json';
import { SYNTHETIC_EXPECTED_TOTALS } from '../data/fixtures/synthetic.expected';

const fixture = fixtureData as unknown as SyntheticFixtureFile;

const TEAMS_DIR = path.join(process.cwd(), 'data', 'teams');

function chargesForSeason(charges: CapCharge[], season: Season): CapCharge[] {
  return charges.filter((c) => c.season === season);
}

function formatDollars(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toLocaleString('en-US')}`;
}

function reportFailure(teamId: string, season: Season, charges: CapCharge[], result: ReturnType<typeof reconcile>) {
  console.error(`FAIL ${teamId} ${season}: reconciliation mismatch (${charges.length} charges).`);
  for (const field of result.fields) {
    if (field.ok) continue;
    console.error(
      `  ${field.field}: actual ${formatDollars(field.actual)} vs expected ${formatDollars(field.expected)} ` +
        `(diff ${formatDollars(field.diff)}, tolerance ±$1)`,
    );
  }
}

function verifySyntheticFixture(): number {
  const seasons = Object.keys(SYNTHETIC_EXPECTED_TOTALS) as Season[];
  let failures = 0;

  for (const season of seasons) {
    const expected: Totals = SYNTHETIC_EXPECTED_TOTALS[season];
    const charges = chargesForSeason(fixture.capCharges, season);
    const result = reconcile(season, charges, expected);

    if (result.ok) {
      console.log(`OK   ${fixture.teamId} ${season}: reconciles against expected totals (${charges.length} charges).`);
      continue;
    }

    failures++;
    reportFailure(fixture.teamId, season, charges, result);
  }

  return failures;
}

// Real ingestion output (M3, extended past OKC to all 30 teams): reconciles
// each team's itemized CapCharges against Basketball-Reference's OWN "Team
// Totals" row for the same page — an independent aggregate the source
// publishes, not a number this repo computed or a figure pulled from anyone's
// memory of real salaries (per CLAUDE.md). This catches parsing bugs (missed
// rows, misattributed seasons, double-counted charges) even though both
// numbers trace back to the same source page. It is NOT a check against an
// externally-known "true" payroll figure.
//
// Scans every file present in data/teams/ rather than a hardcoded team, so
// running `pnpm verify` after `pnpm orchestrate` (or after ingesting a single
// team) covers whatever's actually on disk.
function verifyTeamData(): number {
  if (!existsSync(TEAMS_DIR)) {
    console.log('SKIP team data: data/teams/ not found — run `pnpm ingest` or `pnpm orchestrate` first.');
    return 0;
  }

  const files = readdirSync(TEAMS_DIR).filter((f) => f.endsWith('.json')).sort();
  if (files.length === 0) {
    console.log('SKIP team data: data/teams/ is empty — run `pnpm ingest` or `pnpm orchestrate` first.');
    return 0;
  }

  let failures = 0;

  for (const file of files) {
    const data = JSON.parse(readFileSync(path.join(TEAMS_DIR, file), 'utf-8')) as TeamCapChargesFile;

    if (data.reportedTotals.length === 0) {
      console.error(`FAIL ${data.teamId}: no reported totals found to reconcile against (parser regression?).`);
      failures++;
      continue;
    }

    for (const result of reconcileTeamFile(data)) {
      const charges = chargesForSeason(data.capCharges, result.season);
      if (result.ok) {
        console.log(
          `OK   ${data.teamId} ${result.season}: itemized charges reconcile against Basketball-Reference's ` +
            `reported total (${charges.length} charges).`,
        );
        continue;
      }

      failures++;
      reportFailure(data.teamId, result.season, charges, result);
    }
  }

  return failures;
}

function main(): number {
  const syntheticFailures = verifySyntheticFixture();
  const teamFailures = verifyTeamData();
  return syntheticFailures + teamFailures;
}

const failureCount = main();
if (failureCount !== 0) {
  console.error(`\nverify.ts: ${failureCount} season(s) failed reconciliation.`);
}
process.exit(failureCount === 0 ? 0 : 1);
