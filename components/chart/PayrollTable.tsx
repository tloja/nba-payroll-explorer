import type { Season, SeasonThresholds } from '../../lib/types';
import { mechanismFor } from '../../lib/types';
import type { SeasonStack } from '../../lib/chart/stack';
import { MECHANISM_COLORS } from '../../lib/chart/colors';
import { formatExact, formatRetrievedAt } from '../../lib/format';
import type { ChartToggles, PayrollBasis } from '../../lib/chart/toggles';

// Non-visual equivalent of PayrollChart (spec §9 / CLAUDE.md: "every chart
// ships with a table equivalent"). A visible toggle (see PayrollChart's
// "View as table" button) swaps the whole chart for this, rather than an
// offscreen table living alongside it — one traversable structure at a
// time, no duplicate/hidden content for a screen reader to wade through.
//
// Deliberately reads the same already-toggle-filtered `stacks` PayrollChart
// itself renders from (not raw fixture.capCharges), so this is the same
// data the chart shows, not a second, divergent view of it. The per-charge
// amount column is real dollars (seg.top - seg.bottom), which already
// reflects the active basis/guaranteed-only toggles the same way the bars
// do; guaranteeStatus/optionType/derivation columns come straight off the
// underlying CapCharge for full provenance regardless of toggles.
const BASIS_LABEL: Record<PayrollBasis, string> = {
  cap: 'Cap hit',
  tax: 'Tax hit',
  apron: 'Apron hit',
};

const CHARGE_TYPE_LABEL: Record<string, string> = {
  player: 'Player contract',
  dead_money: 'Dead money',
  cap_hold: 'Cap hold',
  draft_hold: 'Draft hold',
  incomplete_roster: 'Incomplete roster charge',
};

function signedDollar(diff: number): string {
  const sign = diff > 0 ? '+' : diff < 0 ? '−' : '';
  return `${sign}${formatExact(Math.abs(diff))}`;
}

export function PayrollTable({
  teamLabel,
  seasons,
  stacks,
  thresholdsBySeason,
  toggles,
}: {
  teamLabel: string;
  seasons: Season[];
  stacks: SeasonStack[];
  thresholdsBySeason: Map<Season, SeasonThresholds>;
  toggles: ChartToggles;
}) {
  const basisLabel = BASIS_LABEL[toggles.basis];
  const showSeasonColumn = seasons.length > 1;

  return (
    <div className="overflow-x-auto p-4">
      <table className="w-full min-w-[920px] border-collapse text-left text-sm text-ink">
        <caption className="mb-2 text-left text-sm text-ink-muted">
          {teamLabel} payroll, {seasons.join(', ')} — {basisLabel.toLowerCase()}
          {toggles.guaranteedOnly ? ', guaranteed amounts only' : ''}
          {!toggles.includeDeadMoneyAndHolds ? ', excluding dead money and cap holds' : ''}. One row per cap charge,
          in the same fixed stack order as the chart.
        </caption>
        <thead>
          <tr className="border-b border-line">
            {showSeasonColumn && (
              <th scope="col" className="py-1.5 pr-3 font-semibold">
                Season
              </th>
            )}
            <th scope="col" className="py-1.5 pr-3 font-semibold">
              Charge
            </th>
            <th scope="col" className="py-1.5 pr-3 font-semibold">
              Charge type
            </th>
            <th scope="col" className="py-1.5 pr-3 font-semibold">
              Mechanism
            </th>
            <th scope="col" className="py-1.5 pr-3 text-right font-semibold">
              {basisLabel}
            </th>
            <th scope="col" className="py-1.5 pr-3 font-semibold">
              Guarantee
            </th>
            <th scope="col" className="py-1.5 pr-3 font-semibold">
              Option
            </th>
            <th scope="col" className="py-1.5 pr-3 font-semibold">
              Derivation
            </th>
            <th scope="col" className="py-1.5 pr-3 font-semibold">
              Source
            </th>
            <th scope="col" className="py-1.5 pr-3 font-semibold">
              Retrieved
            </th>
          </tr>
        </thead>
        <tbody>
          {stacks.flatMap((stack) => {
            const thresholds = thresholdsBySeason.get(stack.season);
            const rows = stack.segments.map((seg) => {
              const mechanism = mechanismFor(seg.charge);
              const amount = seg.top - seg.bottom;
              return (
                <tr key={`${stack.season}-${seg.entityId}`} className="border-b border-line">
                  {showSeasonColumn && <td className="py-1 pr-3 align-top">{stack.season}</td>}
                  <td className="py-1 pr-3 align-top">{seg.charge.label}</td>
                  <td className="py-1 pr-3 align-top">
                    {CHARGE_TYPE_LABEL[seg.charge.chargeType] ?? seg.charge.chargeType}
                  </td>
                  <td className="py-1 pr-3 align-top">{MECHANISM_COLORS[mechanism].label}</td>
                  <td className="py-1 pr-3 text-right align-top font-mono">{formatExact(amount)}</td>
                  <td className="py-1 pr-3 align-top capitalize">{seg.charge.guaranteeStatus}</td>
                  <td className="py-1 pr-3 align-top">
                    {/* Every option-bearing charge this site ingests is conservatively
                        unresolved (lib/cba/engine.ts never sets optionDecided: true — BR's
                        exercise-date notes aren't parsed), so any non-null optionType here
                        always means "not yet decided," not just "this season has an option." */}
                    {seg.charge.optionType ? `${seg.charge.optionType.toUpperCase()} (not yet decided)` : '—'}
                  </td>
                  <td className="py-1 pr-3 align-top capitalize">{seg.charge.derivation}</td>
                  <td className="py-1 pr-3 align-top">
                    <a
                      href={seg.charge.sourceUrl}
                      className="text-accent underline underline-offset-2 hover:text-accent-strong"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {seg.charge.sourceId}
                    </a>
                  </td>
                  <td className="py-1 pr-3 align-top font-mono">{formatRetrievedAt(seg.charge.retrievedAt)}</td>
                </tr>
              );
            });

            const totalRow = (
              <tr key={`${stack.season}-total`} className="border-b-2 border-ink font-semibold">
                {showSeasonColumn && <td className="py-1.5 pr-3 align-top">{stack.season}</td>}
                <td className="py-1.5 pr-3 align-top" colSpan={3}>
                  Total ({basisLabel.toLowerCase()})
                </td>
                <td className="py-1.5 pr-3 text-right align-top font-mono">{formatExact(stack.total)}</td>
                <td className="py-1.5 pr-3 align-top" colSpan={5}>
                  {thresholds ? (
                    <>
                      vs cap {signedDollar(stack.total - thresholds.salaryCap)}, vs tax{' '}
                      {signedDollar(stack.total - thresholds.taxLevel)}, vs apron 1{' '}
                      {signedDollar(stack.total - thresholds.firstApron)}, vs apron 2{' '}
                      {signedDollar(stack.total - thresholds.secondApron)}
                      {thresholds.isProjected ? ' (thresholds projected)' : ''}
                    </>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            );

            return [...rows, totalRow];
          })}
        </tbody>
      </table>
    </div>
  );
}
