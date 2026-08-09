'use client';

import { useMemo, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import type { Season } from '../../lib/types';
import { mechanismFor } from '../../lib/types';
import type { TeamCapChargesFile } from '../../lib/verify/teamFile';
import { buildStackOrder, stackSeason } from '../../lib/chart/stack';
import { bandOverages, projectedDash } from '../../lib/chart/thresholds';
import { dollarDomainCeiling } from '../../lib/chart/scales';
import { mechanismPatternId } from '../../lib/chart/colors';
import { MechanismPatternDefs } from '../chart/MechanismPatternDefs';
import { resolveTeamBarColor } from '../../lib/team-colors';
import { formatAbbreviated, formatExact } from '../../lib/format';
import { thresholdsForSeason } from '../../data/thresholds';
import { useContainerWidth } from '../../lib/chart/useContainerWidth';
import { useColorScheme } from '../../lib/theme';
import { LeagueTable } from './LeagueTable';

// All 30 teams as thin horizontal bars against shared threshold lines (spec
// §6's "who's in the aprons" view). Deliberately not PayrollChart rendered
// smaller: money runs along x here instead of y, there's one row per team
// instead of one band per season, and there's no room for per-player labels
// at 30-row scale. What's reused is the same math PayrollChart uses —
// buildStackOrder/stackSeason for the per-team segments, bandOverages for the
// over-threshold shading, dollarDomainCeiling for the axis ceiling.
//
// M10: bar fill is each team's own resolved brand color (lib/team-colors.ts),
// not the shared MECHANISM_COLORS ramp — that ramp (and its patterns) stays
// exactly as-is on the team-page chart (PayrollChart.tsx), untouched by this
// milestone. The mechanism pattern overlay is kept here too: it's the
// non-color channel for a segment's contract mechanism/tier, and that
// information didn't stop existing just because color now encodes team
// identity instead.
const ROW_HEIGHT = 24;
const BAR_HEIGHT = 14;
const HEADER_HEIGHT = 20;
const NAME_COLUMN = { max: 64, min: 44 };
const RIGHT_MARGIN = { max: 90, min: 56 };

// PRIMARY_INK's only remaining use here is the over-threshold shading tint
// (a semantic overlay on top of each team's own fill — see PayrollChart.tsx's
// module-level comment for why that stays fixed regardless of theme rather
// than adapting). Every other role that used to be one of these four
// constants (row gridlines, the threshold reference lines, the team-name
// link text, the per-row total label) is chart *furniture* — never
// anchored to interpreting one segment's own fill — and now reads from
// `canvas` (computed from `useColorScheme()` inside the component) instead.
const PRIMARY_INK = '#0b0b0b';
const LIGHT_CANVAS = { gridline: '#e1e0d9', secondary: '#52514e', primary: '#0b0b0b' };
const DARK_CANVAS = { gridline: '#2a2b37', secondary: '#9799a6', primary: '#eceef3' };

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
  const { ref, width, hasMeasured } = useContainerWidth<HTMLDivElement>(960);
  const scheme = useColorScheme();
  const canvas = scheme === 'dark' ? DARK_CANVAS : LIGHT_CANVAS;
  const thresholds = thresholdsForSeason(season)!;
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');

  const rows = useMemo(() => {
    return teams
      .map(({ slug, data }) => {
        const charges = data.capCharges.filter((c) => c.season === season);
        const order = buildStackOrder(charges);
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
    // M12 follow-up: card bg/border use the site's own tokens now, same as
    // any other card. What stays fixed regardless of theme is the per-team
    // fill encoding itself (lib/team-colors.ts, M10) and the ink drawn
    // directly on top of it (the "estimated" outline already uses each
    // team's own contrast-checked labelInk; the over-threshold shading tint
    // stays PRIMARY_INK — see the module-level comment above). Everything
    // else — gridlines, threshold reference lines, team-name/total-label
    // text — reads from `canvas` and adapts. The card styling lives on this
    // outer wrapper, not the `ref`'d div below, so `useContainerWidth`'s
    // measurement keeps reading the already-padding-adjusted content width
    // for free, via normal box layout — no chart-geometry math needed.
    <div className="rounded-2xl border border-line bg-surface p-4">
    <div ref={ref} className="w-full">
      <button
        type="button"
        aria-pressed={viewMode === 'table'}
        onClick={() => setViewMode((m) => (m === 'chart' ? 'table' : 'chart'))}
        className="mb-3 rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-ink outline-none transition-colors hover:bg-surface-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
        {THRESHOLD_KEYS.map((key) => (
          <span key={key} className="flex items-center gap-1.5">
            <svg width="14" height="2" aria-hidden="true">
              <line
                x1={0}
                x2={14}
                y1={1}
                y2={1}
                stroke={canvas.secondary}
                strokeWidth={THRESHOLD_STYLE[key].width}
                strokeDasharray={projectedDash(THRESHOLD_STYLE[key].dash, thresholds.isProjected)}
              />
            </svg>
            {THRESHOLD_STYLE[key].name} {formatAbbreviated(thresholds[key])}
            {thresholds.isProjected ? ' (proj.)' : ''}
          </span>
        ))}
      </div>
      {!hasMeasured ? (
        // Real width isn't known yet — see useContainerWidth's comment for
        // why `next dev` specifically (not the actual static-export build)
        // can otherwise paint this chart once at the wrong, fallback-width
        // geometry before correcting. Same height as the real SVG so
        // nothing below this reflows once it swaps in.
        <div
          className="animate-pulse rounded bg-surface-raised"
          style={{ height: svgHeight }}
          aria-hidden="true"
        />
      ) : (
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
        <MechanismPatternDefs />
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
                stroke={canvas.secondary}
                strokeWidth={style.width}
                strokeDasharray={projectedDash(style.dash, thresholds.isProjected)}
              />
            );
          })}

          {rows.map((row, i) => {
            const y = HEADER_HEIGHT + i * ROW_HEIGHT;
            const barY = y + (ROW_HEIGHT - BAR_HEIGHT) / 2;
            // One resolved color per team, applied to every segment in its
            // bar — a fill-color swap only (spec M10 item 3), not a change
            // to stacking, thresholds, or sort order. labelInk is reused as
            // the "estimated" dashed-outline stroke below: SECONDARY_INK
            // (the ink used elsewhere in this chart) doesn't reliably read
            // against every possible team fill — several teams' resolved
            // fills are near-black — so the outline needs a per-team,
            // contrast-checked ink instead of one fixed color.
            const teamColor = resolveTeamBarColor(row.teamId);
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
                <line x1={0} x2={plotWidth} y1={y} y2={y} stroke={canvas.gridline} strokeWidth={1} />

                <a href={`/team/${row.slug}`}>
                  <text
                    x={-8}
                    y={y + ROW_HEIGHT / 2}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fontSize={11}
                    fill={canvas.primary}
                    style={{ textDecoration: 'underline', cursor: 'pointer' }}
                  >
                    <title>{`${row.teamLabel} — view team page`}</title>
                    {row.teamId}
                  </text>
                </a>

                {row.stack.segments.map((seg) => {
                  const mechanism = mechanismFor(seg.charge);
                  const patternId = mechanismPatternId(mechanism);
                  const isEstimated = seg.charge.derivation === 'estimated';
                  const x = xScale(seg.bottom);
                  const segWidth = Math.max(0, xScale(seg.top) - x);
                  return (
                    <g key={seg.entityId}>
                      <rect
                        x={x}
                        y={barY}
                        width={segWidth}
                        height={BAR_HEIGHT}
                        fill={teamColor.fill}
                        stroke={isEstimated ? teamColor.labelInk : 'none'}
                        strokeWidth={isEstimated ? 1 : 0}
                        strokeDasharray={isEstimated ? '3,2' : undefined}
                        tabIndex={0}
                        role="graphics-symbol"
                        aria-label={`${row.teamLabel}: ${seg.charge.label}, ${formatExact(seg.charge.capHit)}, ${
                          isEstimated ? 'estimated' : seg.charge.derivation
                        }`}
                        className="outline-none focus-visible:stroke-black focus-visible:stroke-2"
                      >
                        <title>{`${row.teamLabel} — ${seg.charge.label}: ${formatExact(seg.charge.capHit)} (${seg.charge.derivation})`}</title>
                      </rect>
                      {patternId && (
                        <rect
                          x={x}
                          y={barY}
                          width={segWidth}
                          height={BAR_HEIGHT}
                          fill={`url(#${patternId})`}
                          pointerEvents="none"
                          aria-hidden="true"
                        />
                      )}
                    </g>
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
                  fill={canvas.secondary}
                >
                  {formatAbbreviated(row.stack.total)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      )}
        </>
      )}
    </div>
    </div>
  );
}
