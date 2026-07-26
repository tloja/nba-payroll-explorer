import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseTeamContractsPage } from '../parse';

// Real Basketball-Reference OKC contracts page, fetched 2026-07-25 while
// respecting robots.txt's crawl-delay (single request). Frozen as a fixture
// so this pure-function test doesn't hit the network.
const html = readFileSync(path.join(__dirname, 'fixtures/okc-contracts.html'), 'utf-8');

const ctx = {
  teamId: 'OKC',
  sourceId: 'basketball-reference',
  sourceUrl: 'https://www.basketball-reference.com/contracts/OKC.html',
  retrievedAt: '2026-07-25T00:00:00.000Z',
};

const contracts = parseTeamContractsPage(html, ctx);

function find(playerId: string) {
  const c = contracts.find((c) => c.playerId === playerId);
  if (!c) throw new Error(`fixture missing expected player ${playerId}`);
  return c;
}

describe('parseTeamContractsPage', () => {
  it('excludes two-way contracts entirely (all-blank salary rows emit no contract)', () => {
    // Dix, Barnhizer, Oweh are two-way signees per the page; their salary
    // columns are blank for every season.
    expect(contracts.find((c) => c.playerId === 'dixjo01')).toBeUndefined();
    expect(contracts.find((c) => c.playerId === 'barnhbr01')).toBeUndefined();
    expect(contracts.find((c) => c.playerId === 'owehot01')).toBeUndefined();
  });

  it('does not pick up the tfoot "Team Totals" row as a player', () => {
    expect(contracts.some((c) => c.playerLabel.includes('Team Totals'))).toBe(false);
  });

  it('parses a plain fully-guaranteed multi-year contract (Holmgren)', () => {
    const c = find('holmgch01');
    expect(c.playerLabel).toBe('Chet Holmgren');
    expect(c.terms.map((t) => t.season)).toEqual(['2026-27', '2027-28', '2028-29', '2029-30', '2030-31']);
    expect(c.terms.map((t) => t.salary)).toEqual([41_500_000, 44_820_000, 48_140_000, 51_460_000, 54_780_000]);
    expect(c.terms.every((t) => t.guaranteeStatus === 'full')).toBe(true);
    expect(c.terms.every((t) => t.optionType === null)).toBe(true);
    expect(c.derivation).toBe('sourced');
  });

  it('marks a player-option season correctly (SGA, final year)', () => {
    const c = find('gilgesh01');
    const finalYear = c.terms.at(-1)!;
    expect(finalYear.season).toBe('2030-31');
    expect(finalYear.optionType).toBe('player');
    expect(finalYear.salary).toBe(75_646_200);
  });

  it('marks a team-option season correctly (Wallace, year one)', () => {
    const c = find('wallaca01');
    expect(c.terms).toHaveLength(1);
    expect(c.terms[0].optionType).toBe('team');
    expect(c.terms[0].salary).toBe(7_420_806);
  });

  it('resolves a single ambiguous "not fully guaranteed" season via the remain_gtd subtraction (Hartenstein)', () => {
    const c = find('harteis01');
    expect(c.terms.map((t) => t.salary)).toEqual([23_148_148, 25_000_000, 26_851_852]);
    // remain_gtd (48,148,148) exactly equals the sum of the two fully-guaranteed
    // years, so the italicized third year resolves to zero guaranteed dollars.
    expect(c.terms[2].guaranteedAmount).toBe(0);
    expect(c.terms[2].guaranteeStatus).toBe('none');
    expect(c.derivation).toBe('sourced'); // resolvable — no need to downgrade
  });

  it('resolves a single ambiguous season with a blank remain_gtd total (Mitchell)', () => {
    const c = find('mitchaj01');
    expect(c.terms[0].salary).toBe(2_850_000);
    expect(c.terms[0].guaranteedAmount).toBe(0);
    expect(c.terms[0].guaranteeStatus).toBe('none');
    expect(c.terms[1].optionType).toBe('team');
  });

  it('every emitted contract carries full provenance', () => {
    for (const c of contracts) {
      expect(c.sourceId).toBe('basketball-reference');
      expect(c.sourceUrl).toBe(ctx.sourceUrl);
      expect(c.retrievedAt).toBe(ctx.retrievedAt);
    }
  });

  it('parses exactly the players with salary data (14 of 17 rows)', () => {
    expect(contracts).toHaveLength(14);
  });
});
