import type { Season } from '../types';
import type { TeamCapChargesFile } from '../verify/teamFile';
import { thresholdsForSeason } from '../../data/thresholds';
import { buildStackOrder, stackSeason } from '../chart/stack';
import { bandOverages } from '../chart/thresholds';
import { selectableCharges, DEFAULT_TOGGLES } from '../chart/toggles';
import { formatAbbreviated } from '../format';

export type TeamSeasonSummary = {
  season: Season;
  total: number;
  taxOverage: number;
  apron1Overage: number;
  apron2Overage: number;
  /** Plain-language apron/tax status, e.g. "$12.3M over the second apron". */
  statusPhrase: string;
  /** Full <meta description>-ready sentence. */
  description: string;
};

/**
 * A team's real payroll situation for one season, in the form both
 * generateMetadata (spec §10 item 4: "reflecting that team's actual payroll
 * situation... rather than a generic template") and the OG image's headline
 * text need. Computed off the default toggle set (cap basis, holds
 * included, absolute dollars, not guaranteed-only) — the same default a
 * fresh visit to the team page renders — not any particular shared link's
 * toggle state, since metadata/OG images are generated once per route at
 * build time, not once per URL query string.
 */
export function summarizeTeamSeason(data: TeamCapChargesFile, season: Season): TeamSeasonSummary | null {
  const thresholds = thresholdsForSeason(season);
  if (!thresholds) return null;

  const charges = selectableCharges(
    data.capCharges.filter((c) => c.season === season),
    DEFAULT_TOGGLES,
  );
  const order = buildStackOrder(charges, season);
  const stack = stackSeason(charges, season, order);
  const overages = bandOverages(stack.total, thresholds);
  const apron2Overage = overages.find((o) => o.key === 'apron2')!.overage;
  const apron1Overage = overages.find((o) => o.key === 'apron1')!.overage;
  const taxOverage = overages.find((o) => o.key === 'tax')!.overage;

  const statusPhrase =
    apron2Overage > 0
      ? `${formatAbbreviated(apron2Overage)} over the second apron`
      : apron1Overage > 0
        ? `${formatAbbreviated(apron1Overage)} over the first apron`
        : taxOverage > 0
          ? `${formatAbbreviated(taxOverage)} over the tax line`
          : 'under the luxury tax line';

  const projectedNote = thresholds.isProjected ? ' (projected thresholds)' : '';
  const description = `${data.teamLabel}'s ${season} payroll is ${formatAbbreviated(stack.total)} — ${statusPhrase}${projectedNote}. Full cap sheet with dead money, cap holds, and sourced provenance.`;

  return { season, total: stack.total, taxOverage, apron1Overage, apron2Overage, statusPhrase, description };
}
