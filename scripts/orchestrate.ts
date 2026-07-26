// M3 follow-up: loops the existing Basketball-Reference pipeline (robots
// policy -> fetch -> parse -> CBA engine -> CapCharge[] -> reconcile) across
// all 30 NBA teams, sequentially. Reuses the exact same fetch/parse/engine
// modules the single-team `scripts/ingest/run.ts` (OKC only) already built —
// this file is the loop, not a second implementation of the pipeline.
//
// Robots.txt is fetched once for the whole run (it's one site-wide policy,
// not per-team), then crawl-delay is honored between every LIVE request —
// cache hits don't count as a request and don't reset the delay clock. A
// 429/403 aborts the entire run immediately (AbortRunError, per
// DATA-SOURCING.md's constraints); any other per-team failure — a network
// error, or a page whose structure doesn't match what the parser expects —
// is caught, recorded, and the run continues to the next team. Nothing here
// silently patches a number to force reconciliation to pass; a failing team
// is reported, not fixed up.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CapCharge, Season } from '../lib/types';
import { deriveCapCharges } from '../lib/cba/engine';
import { reconcileTeamFile, type TeamCapChargesFile } from '../lib/verify/teamFile';
import type { FieldResult } from '../lib/verify/reconcile';
import { NBA_TEAMS } from './ingest/basketball-reference/teams';
import { AbortRunError, fetchRobotsPolicy, fetchTeamContractsPage } from './ingest/basketball-reference/fetch';
import { parseReportedTotals, parseTeamContractsPage } from './ingest/basketball-reference/parse';

const BASE_URL = 'https://www.basketball-reference.com';
const SOURCE_ID = 'basketball-reference';
const CACHE_DIR = path.join(process.cwd(), '.cache', 'basketball-reference');
const DATA_DIR = path.join(process.cwd(), 'data', 'teams');

type SeasonOutcome = {
  season: Season;
  ok: boolean;
  fields: FieldResult[];
  chargeCount: number;
  estimatedCount: number;
  breakdown: string;
};

type TeamRunResult =
  | { status: 'ok'; teamId: string; teamLabel: string; seasons: SeasonOutcome[] }
  | { status: 'reconciliation_failed'; teamId: string; teamLabel: string; seasons: SeasonOutcome[] }
  | { status: 'no_reported_totals'; teamId: string; teamLabel: string }
  | { status: 'fetch_error'; teamId: string; teamLabel: string; error: string }
  | { status: 'parse_error'; teamId: string; teamLabel: string; error: string };

function formatDollars(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toLocaleString('en-US')}`;
}

// Subtotal by chargeType for a season, to give the end-of-run summary a
// pattern to look at when a season fails reconciliation ("which charge type
// if identifiable") — this isn't an independently-sourced breakdown (BR only
// publishes one aggregate total per season), just a diagnostic of what the
// adapter itself produced for that season.
function chargeTypeBreakdown(charges: CapCharge[], season: Season): string {
  const bySeason = charges.filter((c) => c.season === season);
  const totals = new Map<string, number>();
  for (const c of bySeason) totals.set(c.chargeType, (totals.get(c.chargeType) ?? 0) + c.capHit);
  return [...totals.entries()].map(([type, sum]) => `${type}=${formatDollars(sum)}`).join(', ');
}

async function processTeam(
  team: { slug: string; label: string },
  policy: { crawlDelayMs: number },
  lastRequestAt: { value?: number },
): Promise<TeamRunResult> {
  let page;
  try {
    page = await fetchTeamContractsPage(team.slug, {
      baseUrl: BASE_URL,
      cacheDir: CACHE_DIR,
      crawlDelayMs: policy.crawlDelayMs,
      lastRequestAt: lastRequestAt.value,
    });
  } catch (err) {
    if (err instanceof AbortRunError) throw err; // stop the whole run — not a per-team failure
    return { status: 'fetch_error', teamId: team.slug, teamLabel: team.label, error: err instanceof Error ? err.message : String(err) };
  }

  if (page.fromCache) {
    console.log(`  cache hit for today — skipping live fetch`);
  } else {
    lastRequestAt.value = Date.now();
    console.log(`  fetched live (${page.retrievedAt})`);
  }

  let capCharges: CapCharge[];
  let reportedTotals: { season: Season; total: number }[];
  try {
    const contracts = parseTeamContractsPage(page.html, {
      teamId: team.slug,
      sourceId: SOURCE_ID,
      sourceUrl: page.sourceUrl,
      retrievedAt: page.retrievedAt,
    });
    capCharges = contracts.flatMap((contract) => deriveCapCharges(contract));
    reportedTotals = parseReportedTotals(page.html);
  } catch (err) {
    return { status: 'parse_error', teamId: team.slug, teamLabel: team.label, error: err instanceof Error ? err.message : String(err) };
  }

  const output: TeamCapChargesFile = { teamId: team.slug, teamLabel: team.label, capCharges, reportedTotals };
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(path.join(DATA_DIR, `${team.slug.toLowerCase()}.json`), JSON.stringify(output, null, 2) + '\n', 'utf-8');
  console.log(`  wrote ${capCharges.length} cap charges`);

  if (reportedTotals.length === 0) {
    return { status: 'no_reported_totals', teamId: team.slug, teamLabel: team.label };
  }

  const seasons: SeasonOutcome[] = reconcileTeamFile(output).map((result) => ({
    season: result.season,
    ok: result.ok,
    fields: result.fields,
    chargeCount: capCharges.filter((c) => c.season === result.season).length,
    estimatedCount: capCharges.filter((c) => c.season === result.season && c.derivation === 'estimated').length,
    breakdown: chargeTypeBreakdown(capCharges, result.season),
  }));

  const allOk = seasons.every((s) => s.ok);
  return {
    status: allOk ? 'ok' : 'reconciliation_failed',
    teamId: team.slug,
    teamLabel: team.label,
    seasons,
  };
}

async function main(): Promise<number> {
  console.log(`Orchestrating ingestion for ${NBA_TEAMS.length} teams from Basketball-Reference, sequentially...\n`);

  const policy = await fetchRobotsPolicy(BASE_URL);
  console.log(`robots.txt crawl-delay: ${policy.crawlDelayMs}ms (honored between live requests only)\n`);

  const lastRequestAt: { value?: number } = {};
  const results: TeamRunResult[] = [];

  for (const team of NBA_TEAMS) {
    console.log(`--- ${team.label} (${team.slug}) ---`);
    const result = await processTeam(team, policy, lastRequestAt);
    results.push(result);
  }

  console.log('\n\n=== Orchestration summary ===\n');

  let failureCount = 0;
  for (const r of results) {
    if (r.status === 'ok') {
      console.log(`PASS  ${r.teamLabel} (${r.teamId})`);
      continue;
    }

    failureCount++;
    if (r.status === 'reconciliation_failed') {
      console.log(`FAIL  ${r.teamLabel} (${r.teamId}) — reconciliation mismatch:`);
      for (const s of r.seasons) {
        if (s.ok) continue;
        for (const f of s.fields) {
          if (f.ok) continue;
          console.log(
            `        ${s.season} ${f.field}: actual ${formatDollars(f.actual)} vs expected ${formatDollars(f.expected)} ` +
              `(diff ${formatDollars(f.diff)}, ${s.chargeCount} charges, ${s.estimatedCount} 'estimated')`,
          );
        }
        console.log(`          computed breakdown by chargeType: ${s.breakdown}`);
      }
    } else if (r.status === 'no_reported_totals') {
      console.log(`FAIL  ${r.teamLabel} (${r.teamId}) — no reported totals found on the page to reconcile against (parser regression?)`);
    } else if (r.status === 'fetch_error') {
      console.log(`FAIL  ${r.teamLabel} (${r.teamId}) — fetch error: ${r.error}`);
    } else if (r.status === 'parse_error') {
      console.log(`FAIL  ${r.teamLabel} (${r.teamId}) — page did not match expected structure: ${r.error}`);
    }
  }

  console.log(`\n${results.length} teams processed, ${results.length - failureCount} passed, ${failureCount} failed.`);
  return failureCount === 0 ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    if (err instanceof AbortRunError) {
      console.error(`\n${err.message}`);
      console.error('Aborting the entire run — no retry, per robots.txt/rate-limit policy.');
      process.exit(1);
    }
    console.error('\nOrchestration failed:', err);
    process.exit(1);
  });
