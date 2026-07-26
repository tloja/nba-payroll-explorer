import type { CapCharge, Season } from '../types';
import type { ContractPrimitives, WaiverPrimitives } from './types';
import { nextSeason } from './season';

function chargeId(prefix: string, contractId: string, season: string): string {
  return `${prefix}:${contractId}:${season}`;
}

// One `player` CapCharge per contract year. capHit/taxHit/apronHit are equal
// here (spec §2 allows v1 to set all three equal; incentive modeling that
// would make them diverge is out of scope for this milestone).
export function deriveCapCharges(contract: ContractPrimitives): CapCharge[] {
  return contract.terms.map((term) => {
    const derivation =
      term.optionType !== null && term.optionDecided !== true ? 'estimated' : contract.derivation;

    return {
      id: chargeId('player', contract.contractId, term.season),
      teamId: contract.teamId,
      season: term.season,
      chargeType: 'player',
      label: contract.playerLabel,
      playerId: contract.playerId,
      capHit: term.salary,
      taxHit: term.salary,
      apronHit: term.salary,
      guaranteeStatus: term.guaranteeStatus,
      guaranteedAmount: term.guaranteedAmount,
      optionType: term.optionType,
      exceptionUsed: contract.exceptionUsed,
      signedDate: contract.signedDate,
      sourceId: contract.sourceId,
      sourceUrl: contract.sourceUrl,
      retrievedAt: contract.retrievedAt,
      derivation,
    };
  });
}

// Dead money from a waived contract (spec §2/§9). Not stretched: each
// remaining season's guaranteed amount counts on its original schedule.
// Stretched: total remaining guaranteed money spreads evenly over
// (2 * remaining years + 1) seasons starting at waivedSeason.
export function deriveDeadMoney(waiver: WaiverPrimitives): CapCharge[] {
  if (waiver.remainingTerms.length === 0) return [];

  if (!waiver.stretched) {
    return waiver.remainingTerms.map((term) => ({
      id: chargeId('dead', waiver.contractId, term.season),
      teamId: waiver.teamId,
      season: term.season,
      chargeType: 'dead_money',
      label: `Dead money: ${waiver.playerLabel}`,
      playerId: waiver.playerId,
      capHit: term.guaranteedAmount,
      taxHit: term.guaranteedAmount,
      apronHit: term.guaranteedAmount,
      guaranteeStatus: 'full',
      guaranteedAmount: term.guaranteedAmount,
      optionType: null,
      sourceId: waiver.sourceId,
      sourceUrl: waiver.sourceUrl,
      retrievedAt: waiver.retrievedAt,
      derivation: waiver.derivation,
    }));
  }

  const n = waiver.remainingTerms.length;
  const total = waiver.remainingTerms.reduce((sum, t) => sum + t.guaranteedAmount, 0);
  const spreadYears = 2 * n + 1;
  const perYear = Math.round(total / spreadYears);

  const seasons: Season[] = [];
  let season = waiver.waivedSeason;
  for (let i = 0; i < spreadYears; i++) {
    seasons.push(season);
    season = nextSeason(season);
  }

  const amounts = seasons.map(() => perYear);
  const remainder = total - perYear * spreadYears;
  amounts[amounts.length - 1] += remainder; // reconcile rounding onto the final season

  return seasons.map((s, i) => ({
    id: chargeId('dead-stretch', waiver.contractId, s),
    teamId: waiver.teamId,
    season: s,
    chargeType: 'dead_money',
    label: `Dead money (stretched): ${waiver.playerLabel}`,
    playerId: waiver.playerId,
    capHit: amounts[i],
    taxHit: amounts[i],
    apronHit: amounts[i],
    guaranteeStatus: 'full',
    guaranteedAmount: amounts[i],
    optionType: null,
    sourceId: waiver.sourceId,
    sourceUrl: waiver.sourceUrl,
    retrievedAt: waiver.retrievedAt,
    derivation: waiver.derivation,
  }));
}
