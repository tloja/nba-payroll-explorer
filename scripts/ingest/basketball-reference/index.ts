import path from 'node:path';
import type { CapCharge } from '../../../lib/types';
import { deriveCapCharges } from '../../../lib/cba/engine';
import { fetchRobotsPolicy, fetchTeamContractsPage } from './fetch';
import { parseTeamContractsPage, parseReportedTotals, type ReportedTotal } from './parse';

const BASE_URL = 'https://www.basketball-reference.com';
const SOURCE_ID = 'basketball-reference';
const CACHE_DIR = path.join(process.cwd(), '.cache', 'basketball-reference');

export type IngestResult = { capCharges: CapCharge[]; reportedTotals: ReportedTotal[] };

// Orchestrates one team through the full pipeline: robots policy -> fetch ->
// parse -> CBA engine -> flat CapCharge[], alongside the source page's own
// reported season totals (for verify.ts's reconciliation pass). This is the
// only exported entry point for the adapter; scripts/ingest/run.ts calls it
// for 'OKC' only, per the M3 instructions not to loop all 30 teams yet.
export async function ingestTeam(teamSlug: string): Promise<IngestResult> {
  const policy = await fetchRobotsPolicy(BASE_URL);
  const page = await fetchTeamContractsPage(teamSlug, {
    baseUrl: BASE_URL,
    cacheDir: CACHE_DIR,
    crawlDelayMs: policy.crawlDelayMs,
  });

  const contracts = parseTeamContractsPage(page.html, {
    teamId: teamSlug,
    sourceId: SOURCE_ID,
    sourceUrl: page.sourceUrl,
    retrievedAt: page.retrievedAt,
  });

  const capCharges = contracts.flatMap((contract) => deriveCapCharges(contract));
  const reportedTotals = parseReportedTotals(page.html);
  return { capCharges, reportedTotals };
}
