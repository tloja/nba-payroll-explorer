export type Season = `${number}-${number}`; // "2026-27"

export type ChargeType =
  | 'player'
  | 'dead_money'
  | 'cap_hold'
  | 'draft_hold'
  | 'incomplete_roster';

export type GuaranteeStatus = 'full' | 'partial' | 'none';

export type OptionType = 'player' | 'team' | 'eto' | null;

export type Derivation = 'sourced' | 'computed' | 'estimated' | 'synthetic';

// Every cap charge carries full provenance (CLAUDE.md: no exceptions).
export type CapCharge = {
  id: string;
  teamId: string;
  season: Season;
  chargeType: ChargeType;
  label: string;
  playerId?: string;
  capHit: number;
  taxHit: number;
  apronHit: number;
  guaranteeStatus: GuaranteeStatus;
  guaranteedAmount?: number;
  optionType: OptionType;
  exceptionUsed?: string;
  signedDate?: string;
  sourceId: string;
  sourceUrl: string;
  retrievedAt: string;
  derivation: Derivation;
};

export type SeasonThresholds = {
  season: Season;
  isProjected: boolean;
  salaryCap: number;
  minimumTeamSalary: number;
  taxLevel: number;
  firstApron: number;
  secondApron: number;
};

// The shape PayrollChart renders: a team, its cap charges, and the season
// thresholds to draw. Despite the name's history (M1 only ever fed this
// synthetic data), nothing about it is synthetic-specific — M4 feeds the same
// shape real per-team ingestion output, composed with SEASON_THRESHOLDS.
export type TeamPayrollData = {
  teamId: string;
  teamLabel: string;
  thresholds: SeasonThresholds[];
  capCharges: CapCharge[];
};

// Shape of the M1 fixture as it's actually authored on disk
// (data/fixtures/synthetic.json): thresholds are real, sourced values
// (data/thresholds.ts), not part of a synthetic team's fabricated data, so the
// file itself only carries the team and its charges. Callers compose the two
// into a TeamPayrollData at load time.
export type SyntheticFixtureFile = Omit<TeamPayrollData, 'thresholds'>;

// The six contract-mechanism color categories (spec §5).
export type ContractMechanism =
  | 'max'
  | 'rookie_scale'
  | 'mle'
  | 'minimum'
  | 'dead_money'
  | 'hold';

const MLE_EXCEPTIONS = new Set([
  'non-taxpayer mle',
  'taxpayer mle',
  'room mle',
  'bae',
]);

export function mechanismFor(charge: CapCharge): ContractMechanism {
  if (charge.chargeType === 'dead_money') return 'dead_money';
  if (charge.chargeType === 'cap_hold' || charge.chargeType === 'draft_hold') return 'hold';

  const exception = charge.exceptionUsed?.toLowerCase();
  if (exception === 'max' || exception === 'supermax') return 'max';
  if (exception === 'rookie scale') return 'rookie_scale';
  if (exception === 'minimum') return 'minimum';
  if (exception && MLE_EXCEPTIONS.has(exception)) return 'mle';

  // incomplete_roster and any unclassified standard deal fall back to minimum-tier
  // styling — the fixture never emits this case, but the chart must render something.
  return 'minimum';
}
