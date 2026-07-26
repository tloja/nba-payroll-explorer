import { describe, expect, it } from 'vitest';
import { linearRaiseContract } from '../contract';
import { deriveCapCharges, deriveDeadMoney } from '../engine';
import type { WaiverPrimitives } from '../types';

const BASE = {
  contractId: 'c1',
  playerId: 'p1',
  playerLabel: 'Test Player',
  teamId: 'TST',
  sourceId: 'hand-authored-test',
  sourceUrl: 'https://example.invalid/test-fixture',
  retrievedAt: '2026-07-25T00:00:00.000Z',
  derivation: 'computed' as const,
};

describe('deriveCapCharges: max deal', () => {
  // 4yr fictional max, 8% linear raises (max allowed for a Bird re-signing),
  // fully guaranteed, no options.
  const contract = linearRaiseContract({
    ...BASE,
    startSeason: '2025-26',
    startSalary: 50_000_000,
    years: 4,
    annualRaisePct: 0.08,
    terms: [
      { guaranteeStatus: 'full', optionType: null },
      { guaranteeStatus: 'full', optionType: null },
      { guaranteeStatus: 'full', optionType: null },
      { guaranteeStatus: 'full', optionType: null },
    ],
  });
  const charges = deriveCapCharges(contract);

  it('computes linear (not compounded) raises off the first-year salary', () => {
    expect(charges.map((c) => c.capHit)).toEqual([50_000_000, 54_000_000, 58_000_000, 62_000_000]);
  });

  it('sets capHit === taxHit === apronHit for a plain contract (v1)', () => {
    for (const c of charges) {
      expect(c.taxHit).toBe(c.capHit);
      expect(c.apronHit).toBe(c.capHit);
    }
  });

  it('carries full guarantee through to guaranteedAmount', () => {
    for (const c of charges) {
      expect(c.guaranteeStatus).toBe('full');
      expect(c.guaranteedAmount).toBe(c.capHit);
    }
  });

  it('assigns the correct seasons', () => {
    expect(charges.map((c) => c.season)).toEqual(['2025-26', '2026-27', '2027-28', '2028-29']);
  });

  it('inherits the contract-level derivation when there are no options', () => {
    for (const c of charges) expect(c.derivation).toBe('computed');
  });
});

describe('deriveCapCharges: rookie-scale deal with pending team options', () => {
  // 4yr rookie-scale shape: years 1-2 guaranteed, years 3-4 team options not
  // yet decided.
  const contract = linearRaiseContract({
    ...BASE,
    contractId: 'c2',
    exceptionUsed: 'rookie scale',
    startSeason: '2025-26',
    startSalary: 10_000_000,
    years: 4,
    annualRaisePct: 0.05,
    terms: [
      { guaranteeStatus: 'full', optionType: null },
      { guaranteeStatus: 'full', optionType: null },
      { guaranteeStatus: 'full', optionType: 'team', optionDecided: false },
      { guaranteeStatus: 'full', optionType: 'team', optionDecided: false },
    ],
  });
  const charges = deriveCapCharges(contract);

  it('computes the rookie-scale raise step', () => {
    expect(charges.map((c) => c.capHit)).toEqual([10_000_000, 10_500_000, 11_000_000, 11_500_000]);
  });

  it('keeps decided (locked-in) seasons at the contract-level derivation', () => {
    expect(charges[0].derivation).toBe('computed');
    expect(charges[1].derivation).toBe('computed');
  });

  it('downgrades undecided option seasons to estimated, regardless of contract derivation', () => {
    expect(charges[2].optionType).toBe('team');
    expect(charges[2].derivation).toBe('estimated');
    expect(charges[3].optionType).toBe('team');
    expect(charges[3].derivation).toBe('estimated');
  });

  it('does not change capHit for an undecided option season', () => {
    // The chart still needs a number to draw even though the option is
    // uncertain — derivation carries the uncertainty, not a missing value.
    expect(charges[2].capHit).toBe(11_000_000);
  });
});

describe('deriveDeadMoney: stretched waiver', () => {
  // 2 seasons remaining at time of waiver, guaranteed amounts chosen so the
  // even split doesn't divide evenly — exercises the rounding-remainder path.
  const waiver: WaiverPrimitives = {
    contractId: 'c3',
    playerId: 'p3',
    playerLabel: 'Waived Player',
    teamId: 'TST',
    waivedSeason: '2025-26',
    remainingTerms: [
      { season: '2025-26', guaranteedAmount: 8_000_001 },
      { season: '2026-27', guaranteedAmount: 9_000_000 },
    ],
    stretched: true,
    sourceId: 'hand-authored-test',
    sourceUrl: 'https://example.invalid/test-fixture',
    retrievedAt: '2026-07-25T00:00:00.000Z',
    derivation: 'computed',
  };
  const charges = deriveDeadMoney(waiver);

  it('spreads over 2 * remaining years + 1 seasons', () => {
    expect(charges).toHaveLength(5);
    expect(charges.map((c) => c.season)).toEqual([
      '2025-26',
      '2026-27',
      '2027-28',
      '2028-29',
      '2029-30',
    ]);
  });

  it('splits the total as evenly as whole dollars allow', () => {
    // total = 17,000,001 / 5 = 3,400,000.2 -> 3,400,000 each, remainder on the last season
    expect(charges.slice(0, 4).map((c) => c.capHit)).toEqual([3_400_000, 3_400_000, 3_400_000, 3_400_000]);
    expect(charges[4].capHit).toBe(3_400_001);
  });

  it('sums to exactly the original total (no float drift)', () => {
    const total = charges.reduce((sum, c) => sum + c.capHit, 0);
    expect(total).toBe(17_000_001);
  });

  it('marks every stretched charge as dead_money with a distinct label', () => {
    for (const c of charges) {
      expect(c.chargeType).toBe('dead_money');
      expect(c.label).toContain('stretched');
    }
  });
});

describe('deriveDeadMoney: non-stretched waiver', () => {
  const waiver: WaiverPrimitives = {
    contractId: 'c4',
    playerId: 'p4',
    playerLabel: 'Cut Player',
    teamId: 'TST',
    waivedSeason: '2025-26',
    remainingTerms: [{ season: '2025-26', guaranteedAmount: 4_000_000 }],
    stretched: false,
    sourceId: 'hand-authored-test',
    sourceUrl: 'https://example.invalid/test-fixture',
    retrievedAt: '2026-07-25T00:00:00.000Z',
    derivation: 'computed',
  };
  const charges = deriveDeadMoney(waiver);

  it('counts the full remaining guarantee against the original season only', () => {
    expect(charges).toHaveLength(1);
    expect(charges[0].season).toBe('2025-26');
    expect(charges[0].capHit).toBe(4_000_000);
  });
});

describe('deriveCapCharges: partial guarantee', () => {
  const contract = linearRaiseContract({
    ...BASE,
    contractId: 'c5',
    startSeason: '2025-26',
    startSalary: 5_000_000,
    years: 1,
    annualRaisePct: 0,
    terms: [{ guaranteeStatus: 'partial', guaranteedAmount: 1_000_000, optionType: null }],
  });
  const charges = deriveCapCharges(contract);

  it('counts the full scheduled salary against the cap while on the roster', () => {
    // Guarantee status affects dead-money exposure if waived, not the
    // while-rostered cap charge — a partially guaranteed player still counts
    // their full salary against the cap until they're actually cut.
    expect(charges[0].capHit).toBe(5_000_000);
  });

  it('carries only the guaranteed portion in guaranteedAmount', () => {
    expect(charges[0].guaranteeStatus).toBe('partial');
    expect(charges[0].guaranteedAmount).toBe(1_000_000);
  });

  it('throws if a partial guarantee omits an explicit guaranteedAmount', () => {
    expect(() =>
      linearRaiseContract({
        ...BASE,
        contractId: 'c6',
        startSeason: '2025-26',
        startSalary: 5_000_000,
        years: 1,
        annualRaisePct: 0,
        terms: [{ guaranteeStatus: 'partial', optionType: null }],
      }),
    ).toThrow(/explicit guaranteedAmount/);
  });
});
