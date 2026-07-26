import type { ContractMechanism } from '../types';

// Contract-mechanism color encoding (spec §5): one hue as a lightness ramp
// across the four active-contract tiers — max is the most "senior"/least
// common, minimum the lightest/most common — plus two reserved off-hues for
// dead money and holds, which aren't a tier of active contract and can land
// anywhere in the stack by dollar value, not just next to their ramp
// neighbors. Hex values are steps from the dataviz skill's documented
// default sequential-blue ramp and categorical slots 2/3
// (references/palette.md), not eyeballed.
//
// `textColor` is the WCAG-AA-passing (>=4.5:1) label color for that fill —
// computed, not guessed: see NOTES.md for the contrast table. Step 450 on
// the blue ramp fails 4.5:1 with *either* black or white text (4.42 /
// 4.46), so the ramp skips it — mle uses step 500 instead of the
// "expected" 450, which is why the four steps aren't evenly spaced.
//
// Dark-mode variants aren't included: the palette's reference dark values
// only cover the two off-hues (categorical slots 2/3); the ramp's dark
// steps aren't published, and this milestone doesn't require dark mode, so
// guessing them was out of scope rather than validated.
export const MECHANISM_COLORS: Record<
  ContractMechanism,
  { fill: string; textColor: string; label: string }
> = {
  minimum: { fill: '#86b6ef', textColor: '#0b0b0b', label: 'Minimum' },
  rookie_scale: { fill: '#5598e7', textColor: '#0b0b0b', label: 'Rookie scale' },
  mle: { fill: '#256abf', textColor: '#ffffff', label: 'Exception (MLE / BAE)' },
  max: { fill: '#104281', textColor: '#ffffff', label: 'Max / supermax' },
  dead_money: { fill: '#eb6834', textColor: '#0b0b0b', label: 'Dead money' },
  hold: { fill: '#1baf7a', textColor: '#0b0b0b', label: 'Cap hold' },
};

export function mechanismColor(mechanism: ContractMechanism): { fill: string; textColor: string } {
  return MECHANISM_COLORS[mechanism];
}

// Legend order: the ordinal ramp low-to-high, then the two off-hues.
export const MECHANISM_LEGEND_ORDER: ContractMechanism[] = [
  'minimum',
  'rookie_scale',
  'mle',
  'max',
  'dead_money',
  'hold',
];
