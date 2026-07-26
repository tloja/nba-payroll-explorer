import type { Derivation, GuaranteeStatus, OptionType, Season } from '../types';

// A single season's terms within a signed contract. This is the unit the rules
// engine turns 1:1 into a `player` CapCharge (spec §2/§3).
export type ContractYearTerm = {
  season: Season;
  salary: number; // whole dollars, scheduled salary for this season
  guaranteeStatus: GuaranteeStatus;
  guaranteedAmount: number; // = salary if full, 0 if none, explicit if partial
  optionType: OptionType;
  // Only meaningful when optionType is set. Undefined/false means the option
  // hasn't been exercised/declined yet, which downgrades that season's charge
  // to derivation: 'estimated' regardless of the contract's own derivation —
  // spec §9: "Rookie scale options are exercised in October for the following
  // season... mark it."
  optionDecided?: boolean;
};

export type ContractPrimitives = {
  contractId: string;
  playerId: string;
  playerLabel: string;
  teamId: string;
  exceptionUsed?: string;
  signedDate?: string;
  terms: ContractYearTerm[]; // chronological, one entry per season of the deal
  sourceId: string;
  sourceUrl: string;
  retrievedAt: string;
  derivation: Derivation;
};

export type WaiverYearAmount = {
  season: Season;
  // The guaranteed dollars still owed for this originally-scheduled season as
  // of the waiver — not the full scheduled salary.
  guaranteedAmount: number;
};

export type WaiverPrimitives = {
  contractId: string;
  playerId: string;
  playerLabel: string;
  teamId: string;
  waivedSeason: Season;
  // Guaranteed amounts remaining as of waivedSeason, including waivedSeason
  // itself if any guaranteed money was owed for it.
  remainingTerms: WaiverYearAmount[];
  stretched: boolean;
  sourceId: string;
  sourceUrl: string;
  retrievedAt: string;
  derivation: Derivation;
};
