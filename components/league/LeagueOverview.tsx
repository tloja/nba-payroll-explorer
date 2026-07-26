'use client';

import { useMemo, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import type { Season } from '../../lib/types';
import { mechanismFor } from '../../lib/types';
import type { TeamCapChargesFile } from '../../lib/verify/teamFile';
import { buildStackOrder, stackSeason } from '../../lib/chart/stack';
import { bandOverages } from '../../lib/chart/thresholds';
import { dollarDomainCeiling } from '../../lib/chart/scales';
import { MECHANISM_COLORS } from '../../lib/chart/colors';
import { formatAbbreviated, formatExact } from '../../lib/format';
import { thresholdsForSeason } from '../../data/thresholds';
import { useContainerWidth } from '../../lib/chart/useContainerWidth';
import { LeagueTable } from './LeagueTable';

// All 30 teams as thin horizontal bars against shared threshold lines (spec
// §6's "who's in the aprons" view). Deliberately not PayrollChart rendered
// smaller: money runs along x here instead of y, there's one row per team
// instead of one band per season, and there's no room for per-player labels
// at 30-row scale. What's reused is the same math PayrollChart uses —
// buildStackOrder/stackSeason for the per-team segments, bandOverages for the
// over-threshold shading, dollarDomainCeiling for the axis ceiling, the same
// MECHANISM_COLORS encoding — so there's one place that logic lives, not two.
const ROW_HEIGHT = 24;
const BAR_HEIGHT = 14;
const HEADER_HEIGHT = 20;
const NAME_COLUMN = { max: 64, min: 44 };
const RIGHT_MARGIN = { max: 90, min: 56 };
const MUTED_INK = '#898781';
const SECONDARY_INK = '#52514e';
const PRIMARY_INK = '#0b0b0b';
const GRIDLINE = '#e1e0d9';

// Same four-way dash distinction as PayrollChart.tsx (M6) — cap/tax used to
// both be plain solid lines differing only by 0.5px width, too subtle to
// read at a glance. All four still share one ink color; only line style
// tells them apart.
const THRESHOLD_STYLE: Record<
  'salaryCap' | 'taxLevel' | 'firstApron' | 'secondApron',
  { name: string; dash?: string; width: number }
> = {
  salaryCap: { name: 'Cap', width: 1.5 },
  taxLevel: { name: 'Tax', dash: '1,3', width: 2 },
  firstApron: { name: 'Apron 1', dash: '6,3', width: 2 },
  secondApron: { name: 'Apron 2', dash: '2,3', width: 2.25 },
};
const THRESHOLD_KEYS = Object.keys(THRESHOLD_STYLE) as (keyof typeof THRESHOLD_STYLE)[];

export function LeagueOverview({
  season,
  teams,
}: {
  season: Season;
  teams: { slug: string; data: TeamCapChargesFile }[];
}) {
  const { ref, width } = useContainerWidth<HTMLDivElement>(960);
  const thresholds = thresholdsForSeason(season)!;
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');

  const rows = useMemo(() => {
    return teams
      .map(({ slug, data }) => {
        const charges = data.capCharges.filter((c) => c.season === season);
        const order = buildStackOrder(charges, season);
        const stack = stackSeason(charges, season, order);
        return { slug, teamId: data.teamId, teamLabel: data.teamLabel, stack };
      })
      .sort((a, b) => b.stack.total - a.stack.total);
  }, [teams, season]);

  const nameColumn = Math.max(NAME_COLUMN.min, Math.min(NAME_COLUMN.max, width * 0.08));
  const rightMargin = Math.max(RIGHT_MARGIN.min, Math.min(RIGHT_MARGIN.max, width * 0.14));
  const plotWidth = Math.max(120, width - nameColumn - rightMargin);

  const domainMax = dollarDomainCeiling(
    rows.map((r) => r.stack.total),
    [thresholds.secondApron],
  );
  const xScale = useMemo(
    () => scaleLinear().domain([0, domainMax]).nice().range([0, plotWidth]),
    [domainMax, plotWidth],
  );

  const svgHeight = HEADER_HEIGHT + rows.length * ROW_HEIGHT + 4;
  const plotBottom = HEADER_HEIGHT + rows.length * ROW_HEIGHT;

  return (
    <div ref={ref} className="w-full">
      <button
        type="button"
        aria-pressed={viewMode === 'table'}
        onClick={() => setViewMode((m) => (m === 'chart' ? 'table' : 'chart'))}
        className="mb-3 rounded border border-[#d8d6cf] bg-white px-2.5 py-1 text-xs text-[#0b0b0b] hover:bg-[#f0efe9]"
      >
        {viewMode === 'chart' ? 'View as table' : 'View as chart'}
      </button>

      {viewMode === 'table' ? (
        <LeagueTable
          season={season}
          thresholds={thresholds}
          rows={rows.map((r) => ({ slug: r.slug, teamId: r.teamId, teamLabel: r.teamLabel, total: r.stack.total }))}
        />
      ) : (
        <>
      {/* Threshold values as a fixed-order legend rather than text positioned above
          each line's true x: the four thresholds span only ~$57M (spec §2's known
          figures), so at most plot widths their lines sit close enough together
          that inline labels collide. A legend line has no such failure mode
          regardless of width — same reasoning as PayrollChart's per-season header
          (NOTES.md), just one row instead of one per season since this view has a
          single shared season for every team. */}
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#52514e]">
        {THRESHOLD_KEYS.map((key) => (
          <span key={key} className="flex items-center gap-1.5">
            <svg width="14" height="2" aria-hidden="true">
              <line
                x1={0}
                x2={14}
                y1={1}
                y2={1}
                stroke={SECONDARY_INK}
                strokeWidth={THRESHOLD_STYLE[key].width}
                strokeDasharray={THRESHOLD_STYLE[key].dash}
              />
            </svg>
            {THRESHOLD_STYLE[key].name} {formatAbbreviated(thresholds[key])}
            {thresholds.isProjected ? ' (proj.)' : ''}
          </span>
        ))}
      </div>
      <svg
        width={width}
        height={svgHeight}
        // graphics-document, not img: img forbids focusable descendants, but
        // every team's segments and name link here are individually
        // focusable — see the matching comment in PayrollChart.tsx.
        role="graphics-document"
        aria-label={`League-wide payroll, ${season}, sorted by total payroll`}
        className="font-mono"
      >
        <g transform={`translate(${nameColumn},0)`}>
          {THRESHOLD_KEYS.map((key) => {
            const x = xScale(thresholds[key]);
            const style = THRESHOLD_STYLE[key];
            return (
              <line
                key={key}
                x1={x}
                x2={x}
                y1={HEADER_HEIGHT - 4}
                y2={plotBottom}
                stroke={SECONDARY_INK}
                strokeWidth={style.width}
                strokeDasharray={style.dash}
              />
            );
          })}

          {rows.map((row, i) => {
            const y = HEADER_HEIGHT + i * ROW_HEIGHT;
            const barY = y + (ROW_HEIGHT - BAR_HEIGHT) / 2;
            const overages = bandOverages(row.stack.total, thresholds);
            const taxOverage = overages.find((o) => o.key === 'tax')!.overage;
            const apron1Overage = overages.find((o) => o.key === 'apron1')!.overage;
            const apron2Overage = overages.find((o) => o.key === 'apron2')!.overage;

            const shadeBands: { from: number; to: number; opacity: number }[] = [];
            if (taxOverage > 0) {
              shadeBands.push({
                from: thresholds.taxLevel,
                to: Math.min(row.stack.total, thresholds.firstApron),
                opacity: 0.18,
              });
            }
            if (apron1Overage > 0) {
              shadeBands.push({
                from: thresholds.firstApron,
                to: Math.min(row.stack.total, thresholds.secondApron),
                opacity: 0.32,
              });
            }
            if (apron2Overage > 0) {
              shadeBands.push({ from: thresholds.secondApron, to: row.stack.total, opacity: 0.5 });
            }

            return (
              <g key={row.slug}>
                <line x1={0} x2={plotWidth} y1={y} y2={y} stroke={GRIDLINE} strokeWidth={1} />

                <a href={`/team/${row.slug}`}>
                  <text
                    x={-8}
                    y={y + ROW_HEIGHT / 2}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fontSize={11}
                    fill={PRIMARY_INK}
                    style={{ textDecoration: 'underline', cursor: 'pointer' }}
                  >
                    <title>{`${row.teamLabel} — view team page`}</title>
                    {row.teamId}
                  </text>
                </a>

                {row.stack.segments.map((seg) => {
                  const colors = MECHANISM_COLORS[mechanismFor(seg.charge)];
                  const x = xScale(seg.bottom);
                  const segWidth = Math.max(0, xScale(seg.top) - x);
                  return (
                    <rect
                      key={seg.entityId}
                      x={x}
                      y={barY}
                      width={segWidth}
                      height={BAR_HEIGHT}
                      fill={colors.fill}
                      tabIndex={0}
                      role="graphics-symbol"
                      aria-label={`${row.teamLabel}: ${seg.charge.label}, ${formatExact(seg.charge.capHit)}`}
                      className="outline-none focus-visible:stroke-black focus-visible:stroke-2"
                    >
                      <title>{`${row.teamLabel} — ${seg.charge.label}: ${formatExact(seg.charge.capHit)}`}</title>
                    </rect>
                  );
                })}

                {shadeBands.map((band, bi) => (
                  <rect
                    key={bi}
                    x={xScale(band.from)}
                    y={barY}
                    width={Math.max(0, xScale(band.to) - xScale(band.from))}
                    height={BAR_HEIGHT}
                    fill={PRIMARY_INK}
                    opacity={band.opacity}
                    pointerEvents="none"
                  />
                ))}

                <text
                  x={xScale(row.stack.total) + 6}
                  y={y + ROW_HEIGHT / 2}
                  dominantBaseline="middle"
                  fontSize={10}
                  fill={SECONDARY_INK}
                >
                  {formatAbbreviated(row.stack.total)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
        </>
      )}
    </div>
  );
}
