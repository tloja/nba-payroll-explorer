import * as cheerio from 'cheerio';
import type { CheerioAPI, Cheerio } from 'cheerio';
import type { Element } from 'domhandler';
import type { Season } from '../../../lib/types';
import { explicitScheduleContract, type ExplicitYearInput } from '../../../lib/cba/contract';
import type { ContractPrimitives } from '../../../lib/cba/types';

function loadContractsTable($: CheerioAPI): Cheerio<Element> {
  const table = $('table#contracts');
  if (table.length === 0) {
    throw new Error('could not find table#contracts in the fetched page');
  }
  return table;
}

// Map each "y1".."y6" column key to the season it represents, read from the
// header row's aria-label (e.g. data-stat="y1" -> aria-label="2026-27").
function seasonColumnMap($: CheerioAPI, table: Cheerio<Element>): Map<string, Season> {
  const seasonByColumnKey = new Map<string, Season>();
  table
    .find('thead tr')
    .last()
    .find('th[data-stat^="y"]')
    .each((_, el) => {
      const key = $(el).attr('data-stat');
      const season = $(el).attr('aria-label');
      if (key && season) seasonByColumnKey.set(key, season as Season);
    });
  if (seasonByColumnKey.size === 0) {
    throw new Error('no season columns found in table header');
  }
  return seasonByColumnKey;
}

export type ReportedTotal = { season: Season; total: number };

// The page's own "Team Totals" tfoot row — an aggregate BR publishes
// independently of any per-row parsing we do. Used by verify.ts as a
// reconciliation target: our itemized capCharges should sum to this, ±$1.
export function parseReportedTotals(html: string): ReportedTotal[] {
  const $ = cheerio.load(html);
  const table = loadContractsTable($);
  const seasonByColumnKey = seasonColumnMap($, table);

  const totals: ReportedTotal[] = [];
  const footRow = table.find('tfoot tr').first();
  for (const [columnKey, season] of seasonByColumnKey) {
    const cell = footRow.find(`td[data-stat="${columnKey}"]`);
    const text = cell.text().trim();
    if (!text) continue;
    const total = Number(text.replace(/[$,]/g, ''));
    if (!Number.isNaN(total)) totals.push({ season, total });
  }
  return totals;
}

// Pure function: raw HTML in, contract primitives out. No network, no fs.
// Basketball-Reference-specific markup never leaks past this module
// (CLAUDE.md: "source-specific parsing never leaks past the adapter
// boundary").
export function parseTeamContractsPage(
  html: string,
  ctx: { teamId: string; sourceUrl: string; retrievedAt: string; sourceId: string },
): ContractPrimitives[] {
  const $ = cheerio.load(html);
  const table = loadContractsTable($);
  const seasonByColumnKey = seasonColumnMap($, table);

  const contracts: ContractPrimitives[] = [];

  table.find('tbody > tr').each((_, row) => {
    const $row = $(row);
    const link = $row.find('th[data-stat="player"] a');
    const playerLabel = link.text().trim();
    const href = link.attr('href') ?? '';
    const playerIdMatch = href.match(/\/players\/[a-z]\/([a-z0-9]+)\.html/);
    if (!playerLabel || !playerIdMatch) return; // not a player row (shouldn't happen, but don't guess)
    const playerId = playerIdMatch[1];

    type RawCell = { season: Season; salary: number; optionType: 'team' | 'player' | null; fullyGuaranteed: boolean };
    const cells: RawCell[] = [];

    for (const [columnKey, season] of seasonByColumnKey) {
      const cell = $row.find(`td[data-stat="${columnKey}"]`);
      if (cell.length === 0) continue;
      const classAttr = cell.attr('class') ?? '';
      if (classAttr.includes('iz')) continue; // blank cell: contract doesn't extend to this season

      const csk = cell.attr('csk');
      const salary = csk !== undefined ? Number(csk) : NaN;
      if (Number.isNaN(salary)) continue;

      cells.push({
        season,
        salary,
        optionType: classAttr.includes('salary-tm') ? 'team' : classAttr.includes('salary-pl') ? 'player' : null,
        fullyGuaranteed: cell.find('em').length === 0,
      });
    }

    if (cells.length === 0) return; // two-way / not-yet-signed / no salary data — emit nothing (spec: exclude two-ways)

    const remainGtdCell = $row.find('td[data-stat="remain_gtd"]');
    const remainGtdClass = remainGtdCell.attr('class') ?? '';
    const remainGtdCsk = remainGtdCell.attr('csk');
    const remainingGuaranteed = remainGtdClass.includes('iz') || remainGtdCsk === undefined ? 0 : Number(remainGtdCsk);

    const fullyGuaranteedCells = cells.filter((c) => c.fullyGuaranteed);
    const partiallyMarkedCells = cells.filter((c) => !c.fullyGuaranteed);
    const fullSum = fullyGuaranteedCells.reduce((sum, c) => sum + c.salary, 0);
    const remainder = remainingGuaranteed - fullSum;

    // Only one italicized ("not fully guaranteed") season remaining: the
    // guaranteed portion for it is exactly resolvable by subtraction. More
    // than one is genuinely ambiguous from this table alone (BR gives one
    // aggregate "Guaranteed" total, not a per-season split) — downgrade the
    // whole contract to 'estimated' rather than guess a split, and say so.
    let derivation: 'sourced' | 'estimated' = 'sourced';
    if (partiallyMarkedCells.length > 1) {
      derivation = 'estimated';
      console.warn(
        `[basketball-reference] ${playerLabel}: ${partiallyMarkedCells.length} seasons marked "not fully ` +
          'guaranteed" with only one aggregate remaining-guaranteed total — cannot resolve the exact per-season ' +
          'split. Marking this contract "estimated" rather than guessing.',
      );
    }

    const years: ExplicitYearInput[] = cells.map((c) => {
      if (c.fullyGuaranteed) {
        return { season: c.season, salary: c.salary, guaranteeStatus: 'full', optionType: c.optionType };
      }
      const guaranteedAmount = partiallyMarkedCells.length === 1 ? Math.min(Math.max(remainder, 0), c.salary) : 0;
      const guaranteeStatus = guaranteedAmount === 0 ? 'none' : guaranteedAmount === c.salary ? 'full' : 'partial';
      return { season: c.season, salary: c.salary, guaranteeStatus, guaranteedAmount, optionType: c.optionType };
    });

    contracts.push(
      explicitScheduleContract({
        contractId: `${ctx.teamId}-${playerId}`,
        playerId,
        playerLabel,
        teamId: ctx.teamId,
        years,
        sourceId: ctx.sourceId,
        sourceUrl: ctx.sourceUrl,
        retrievedAt: ctx.retrievedAt,
        derivation,
      }),
    );
  });

  return contracts;
}
