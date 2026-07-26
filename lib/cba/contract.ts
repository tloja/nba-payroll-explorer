import type { Derivation, GuaranteeStatus, OptionType, Season } from '../types';
import type { ContractPrimitives, ContractYearTerm } from './types';
import { addSeasons } from './season';

function resolveGuaranteedAmount(status: GuaranteeStatus, salary: number, explicit?: number): number {
  if (status === 'full') return salary;
  if (status === 'none') return 0;
  if (explicit === undefined) {
    throw new Error('partial guarantee requires an explicit guaranteedAmount');
  }
  return explicit;
}

export type YearTermInput = {
  guaranteeStatus: GuaranteeStatus;
  guaranteedAmount?: number; // required when guaranteeStatus === 'partial'
  optionType: OptionType;
  optionDecided?: boolean;
};

type ContractIdentity = {
  contractId: string;
  playerId: string;
  playerLabel: string;
  teamId: string;
  exceptionUsed?: string;
  signedDate?: string;
  sourceId: string;
  sourceUrl: string;
  retrievedAt: string;
  derivation: Derivation;
};

// For contracts expressed as a starting salary plus a fixed raise percentage —
// the CBA's actual raise rule: each year's raise is a percentage of the FIRST
// league year's salary, applied linearly (not compounded year over year).
// Mainly for hand-built test contracts and any future source that publishes
// primitives in this shape rather than an explicit per-year schedule.
export function linearRaiseContract(
  input: ContractIdentity & {
    startSeason: Season;
    startSalary: number;
    years: number;
    annualRaisePct: number;
    terms: YearTermInput[]; // length must equal years
  },
): ContractPrimitives {
  if (input.terms.length !== input.years) {
    throw new Error(`terms length (${input.terms.length}) must equal years (${input.years})`);
  }

  const terms: ContractYearTerm[] = input.terms.map((term, i) => {
    const salary = Math.round(input.startSalary * (1 + input.annualRaisePct * i));
    return {
      season: addSeasons(input.startSeason, i),
      salary,
      guaranteeStatus: term.guaranteeStatus,
      guaranteedAmount: resolveGuaranteedAmount(term.guaranteeStatus, salary, term.guaranteedAmount),
      optionType: term.optionType,
      optionDecided: term.optionDecided,
    };
  });

  return {
    contractId: input.contractId,
    playerId: input.playerId,
    playerLabel: input.playerLabel,
    teamId: input.teamId,
    exceptionUsed: input.exceptionUsed,
    signedDate: input.signedDate,
    terms,
    sourceId: input.sourceId,
    sourceUrl: input.sourceUrl,
    retrievedAt: input.retrievedAt,
    derivation: input.derivation,
  };
}

export type ExplicitYearInput = {
  season: Season;
  salary: number;
  guaranteeStatus: GuaranteeStatus;
  guaranteedAmount?: number;
  optionType: OptionType;
  optionDecided?: boolean;
};

// For contracts where the actual per-season dollar figure is already known
// (e.g. published directly by a source) rather than reconstructed from a
// start salary and raise percentage. This is what the Basketball-Reference
// adapter uses — BR's contract table already lists the resolved salary for
// every season of the deal.
export function explicitScheduleContract(
  input: ContractIdentity & { years: ExplicitYearInput[] },
): ContractPrimitives {
  const terms: ContractYearTerm[] = input.years.map((y) => ({
    season: y.season,
    salary: y.salary,
    guaranteeStatus: y.guaranteeStatus,
    guaranteedAmount: resolveGuaranteedAmount(y.guaranteeStatus, y.salary, y.guaranteedAmount),
    optionType: y.optionType,
    optionDecided: y.optionDecided,
  }));

  return {
    contractId: input.contractId,
    playerId: input.playerId,
    playerLabel: input.playerLabel,
    teamId: input.teamId,
    exceptionUsed: input.exceptionUsed,
    signedDate: input.signedDate,
    terms,
    sourceId: input.sourceId,
    sourceUrl: input.sourceUrl,
    retrievedAt: input.retrievedAt,
    derivation: input.derivation,
  };
}
