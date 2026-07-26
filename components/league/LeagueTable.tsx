import type { Season, SeasonThresholds } from '../../lib/types';
import { formatExact } from '../../lib/format';

// Non-visual equivalent of LeagueOverview (spec §9 / CLAUDE.md: "every chart
// ships with a table equivalent"), same visible-toggle pattern as
// PayrollChart/PayrollTable. One row per team at the chart's own grain —
// total payroll plus signed distance to each threshold, mirroring the bar
// length + over-threshold shading — not a per-charge breakdown across 30
// teams' full rosters, which would run to hundreds of rows for a
// league-wide bird's-eye view. Each segment's own charge/amount is already
// reachable non-visually via the chart's per-segment aria-label + <title>
// on focus; this table is the "who's over which line, by how much" summary
// the shading itself conveys.
function signedDollar(diff: number): string {
  const sign = diff > 0 ? '+' : diff < 0 ? '−' : '';
  return `${sign}${formatExact(Math.abs(diff))}`;
}

export function LeagueTable({
  season,
  thresholds,
  rows,
}: {
  season: Season;
  thresholds: SeasonThresholds;
  rows: { slug: string; teamId: string; teamLabel: string; total: number }[];
}) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[600px] border-collapse text-left text-sm">
        <caption className="mb-2 text-left text-sm text-[#52514e]">
          All 30 teams, {season}, sorted by total payroll (cap hit), with distance to each threshold.
          {thresholds.isProjected ? ' Thresholds projected.' : ''}
        </caption>
        <thead>
          <tr className="border-b border-[#d8d6cf]">
            <th scope="col" className="py-1.5 pr-3 font-semibold">
              Team
            </th>
            <th scope="col" className="py-1.5 pr-3 text-right font-semibold">
              Total payroll
            </th>
            <th scope="col" className="py-1.5 pr-3 text-right font-semibold">
              vs Cap
            </th>
            <th scope="col" className="py-1.5 pr-3 text-right font-semibold">
              vs Tax
            </th>
            <th scope="col" className="py-1.5 pr-3 text-right font-semibold">
              vs Apron 1
            </th>
            <th scope="col" className="py-1.5 pr-3 text-right font-semibold">
              vs Apron 2
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.slug} className="border-b border-[#eeeee7]">
              <th scope="row" className="py-1 pr-3 align-top font-normal">
                <a href={`/team/${row.slug}`} className="underline">
                  {row.teamLabel}
                </a>
              </th>
              <td className="py-1 pr-3 text-right align-top font-mono">{formatExact(row.total)}</td>
              <td className="py-1 pr-3 text-right align-top font-mono">
                {signedDollar(row.total - thresholds.salaryCap)}
              </td>
              <td className="py-1 pr-3 text-right align-top font-mono">
                {signedDollar(row.total - thresholds.taxLevel)}
              </td>
              <td className="py-1 pr-3 text-right align-top font-mono">
                {signedDollar(row.total - thresholds.firstApron)}
              </td>
              <td className="py-1 pr-3 text-right align-top font-mono">
                {signedDollar(row.total - thresholds.secondApron)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
