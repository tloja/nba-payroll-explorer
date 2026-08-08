import type { Season, SeasonThresholds, TeamPayrollData } from '../types';
import { mechanismFor } from '../types';
import { buildStackOrder, stackSeason, type SeasonStack } from '../chart/stack';
import { buildYScale } from '../chart/scales';
import { bandOverages } from '../chart/thresholds';
import { MECHANISM_COLORS } from '../chart/colors';
import { DEFAULT_TOGGLES, selectableCharges } from '../chart/toggles';
import { formatAbbreviated } from '../format';
import { SITE_HOST } from '../site';

// Build-time OG image renderer (spec §10 item 1). This is deliberately NOT a
// screenshot of <PayrollChart> — Satori (next/og's JSX-to-PNG engine) has no
// browser and can't paint arbitrary <svg> paths or run the label-collision
// algorithm in lib/chart/labels.ts, so per-player leader-line callouts are
// out of reach here regardless. What it DOES reuse, unmodified, from the
// live chart's own pure geometry layer: stack order (buildStackOrder),
// per-segment pixel heights (stackSeason + buildYScale, the same formula
// PayrollChart.tsx uses), threshold-crossing decisions (bandOverages), and
// the exact mechanism color ramp (MECHANISM_COLORS). So the shape, colors,
// totals, and apron status in the OG image are never a second, divergent
// computation of the real data — only the paint layer (simplified: color
// blocks, no per-segment text) differs from the on-site SVG, which matters
// less at 1200x630 thumbnail scale than it would on the full chart.
const WIDTH = 1200;
const HEIGHT = 630;
const PLOT_HEIGHT = 360;
const BAR_WIDTH = 96;
const BAR_GAP = 40;
const LABEL_GUTTER = 210;

const BG = '#f9f9f7';
const INK = '#0b0b0b';
const SECONDARY = '#52514e';
const GRID = '#d8d6cf';

// Satori (next/og's CSS engine) only supports `border-style: solid | dashed`
// — no `dotted` — unlike the live chart's SVG `stroke-dasharray`, which can
// give every threshold a genuinely distinct dash pattern (PayrollChart.tsx's
// THRESHOLD_STYLE). Here, width is the primary differentiator between the
// three dashed lines; each line's adjacent text label (rendered right next
// to it, see below) is still the actual identifying signal, same as the live
// chart where every threshold line carries a direct label rather than
// relying on style alone.
const THRESHOLD_ORDER: {
  key: keyof Pick<SeasonThresholds, 'salaryCap' | 'taxLevel' | 'firstApron' | 'secondApron'>;
  name: string;
  style: 'solid' | 'dashed';
  width: number;
}[] = [
  { key: 'salaryCap', name: 'Cap', style: 'solid', width: 2 },
  { key: 'taxLevel', name: 'Tax', style: 'dashed', width: 1 },
  { key: 'firstApron', name: 'Apron 1', style: 'dashed', width: 2.5 },
  { key: 'secondApron', name: 'Apron 2', style: 'dashed', width: 4 },
];

function ogFallback(title: string, message: string) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        width: WIDTH,
        height: HEIGHT,
        background: BG,
        padding: '56px',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', fontSize: 44, color: INK }}>{title}</div>
      <div style={{ display: 'flex', fontSize: 22, color: SECONDARY, marginTop: 12 }}>{message}</div>
      <div style={{ display: 'flex', fontSize: 18, color: SECONDARY, marginTop: 40 }}>{SITE_HOST}</div>
    </div>
  );
}

/**
 * Renders the JSX tree for a team's OG image, restricted to `seasonsToRender`
 * (every season for the un-seasoned hub route, a single season for the
 * `/[season]` deep link — same restriction pattern PayrollChart's own
 * `seasons` prop uses). Reference threshold lines are drawn at the most
 * recent rendered season's values — today every team has exactly one
 * available season (NOTES.md M4), so this never diverges from correct; once
 * a team spans seasons with different cap/tax/apron figures, only the
 * reference lines simplify to the latest season's numbers, while each bar's
 * own over-threshold shading still uses that bar's own season correctly.
 */
export function renderTeamOgImage(fixture: TeamPayrollData, seasonsToRender: Season[]) {
  const thresholdsBySeason = new Map(fixture.thresholds.map((t) => [t.season, t]));
  const seasons = [...seasonsToRender].filter((s) => thresholdsBySeason.has(s)).sort();

  if (seasons.length === 0) {
    return ogFallback(fixture.teamLabel, 'No season currently has both sourced cap charges and published thresholds.');
  }

  const focusSeason = seasons[seasons.length - 1];
  const charges = selectableCharges(fixture.capCharges, DEFAULT_TOGGLES);
  const order = buildStackOrder(charges);
  const stacks: SeasonStack[] = seasons.map((season) => stackSeason(charges, season, order));
  const thresholdsList = seasons.map((s) => thresholdsBySeason.get(s)!);
  const yScale = buildYScale(stacks, thresholdsList, PLOT_HEIGHT);

  const focusThresholds = thresholdsBySeason.get(focusSeason)!;
  const focusStack = stacks[stacks.length - 1];
  const focusOverages = bandOverages(focusStack.total, focusThresholds);
  const apron2Overage = focusOverages.find((o) => o.key === 'apron2')!.overage;
  const apron1Overage = focusOverages.find((o) => o.key === 'apron1')!.overage;
  const taxOverage = focusOverages.find((o) => o.key === 'tax')!.overage;

  const headline =
    apron2Overage > 0
      ? `${formatAbbreviated(focusStack.total)} total — ${formatAbbreviated(apron2Overage)} over the 2nd apron`
      : apron1Overage > 0
        ? `${formatAbbreviated(focusStack.total)} total — ${formatAbbreviated(apron1Overage)} over the 1st apron`
        : taxOverage > 0
          ? `${formatAbbreviated(focusStack.total)} total — ${formatAbbreviated(taxOverage)} over the tax line`
          : `${formatAbbreviated(focusStack.total)} total payroll`;

  const plotWidth = seasons.length * BAR_WIDTH + (seasons.length - 1) * BAR_GAP;
  const seasonLabel = seasons.length > 1 ? `${seasons[0]}–${focusSeason}` : focusSeason;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: WIDTH,
        height: HEIGHT,
        background: BG,
        padding: '40px 56px',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', fontSize: 44, color: INK }}>{fixture.teamLabel}</div>
        <div style={{ display: 'flex', fontSize: 22, color: SECONDARY, marginTop: 6 }}>
          {seasonLabel} payroll vs. cap, tax &amp; apron thresholds
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          position: 'relative',
          marginTop: 28,
          width: plotWidth + LABEL_GUTTER,
          height: PLOT_HEIGHT,
        }}
      >
        {/* Threshold reference lines, spanning the bars only (labels live in the gutter to
            the right). Cap/tax/apron1/apron2 are frequently within a few percent of each
            other (spec §2's own example figures: tax/apron1/apron2 span barely $22M on a
            ~$240M axis), so their *labels* collide far more often than not — a scaled-down
            version of the exact problem spec §5 calls "the actual hard problem" for the live
            chart's per-player callouts. Full label-collision resolution (lib/chart/labels.ts)
            isn't reusable here (it's built around SegmentGeometry, and Satori can't render
            leader-line paths anyway), so this is a minimal, fixed-size version of the same
            idea: exactly 4 known labels, pushed apart top-down until each clears the previous
            one's line height. The reference line itself always stays at its true y; only the
            label (and a short tick connecting the two when they diverge) moves. */}
        {(() => {
          const LABEL_LINE_HEIGHT = 26;
          const positions = THRESHOLD_ORDER.map((t) => ({ ...t, trueY: yScale(focusThresholds[t.key]) })).sort(
            (a, b) => a.trueY - b.trueY,
          );
          for (let i = 1; i < positions.length; i++) {
            if (positions[i].trueY < positions[i - 1].trueY + LABEL_LINE_HEIGHT) {
              positions[i].trueY = positions[i - 1].trueY + LABEL_LINE_HEIGHT;
            }
          }
          const labelYByKey = new Map(positions.map((p) => [p.key, p.trueY]));

          return THRESHOLD_ORDER.map((t) => {
            const trueY = yScale(focusThresholds[t.key]);
            const labelY = labelYByKey.get(t.key)!;
            return (
              <div key={t.key} style={{ display: 'flex' }}>
                <div
                  style={{
                    display: 'flex',
                    position: 'absolute',
                    left: 0,
                    top: trueY,
                    width: plotWidth,
                    borderTop: `${t.width}px ${t.style} ${SECONDARY}`,
                  }}
                />
                {Math.abs(labelY - trueY) > 1 && (
                  <div
                    style={{
                      display: 'flex',
                      position: 'absolute',
                      left: plotWidth,
                      top: Math.min(trueY, labelY),
                      width: 12,
                      height: Math.max(1, Math.abs(labelY - trueY)),
                      borderRight: `1px solid ${SECONDARY}`,
                    }}
                  />
                )}
                <div
                  style={{
                    display: 'flex',
                    position: 'absolute',
                    left: plotWidth + 14,
                    top: labelY - 12,
                    fontSize: 16,
                    color: SECONDARY,
                  }}
                >
                  {t.name} {formatAbbreviated(focusThresholds[t.key])}
                  {focusThresholds.isProjected ? ' (proj.)' : ''}
                </div>
              </div>
            );
          });
        })()}

        {/* Gridline floor */}
        <div style={{ display: 'flex', position: 'absolute', left: 0, top: PLOT_HEIGHT - 1, width: plotWidth, borderTop: `1px solid ${GRID}` }} />

        {seasons.map((season, i) => {
          const stack = stacks[i];
          const thresholds = thresholdsList[i];
          const x = i * (BAR_WIDTH + BAR_GAP);
          const overages = bandOverages(stack.total, thresholds);
          const apron2 = overages.find((o) => o.key === 'apron2')!.overage;
          const apron1 = overages.find((o) => o.key === 'apron1')!.overage;
          const tax = overages.find((o) => o.key === 'tax')!.overage;

          return (
            <div key={season} style={{ display: 'flex', position: 'absolute', left: x, top: 0, width: BAR_WIDTH, height: PLOT_HEIGHT }}>
              {stack.segments.map((seg) => {
                const topPx = yScale(seg.top);
                const bottomPx = yScale(seg.bottom);
                const h = Math.max(1, bottomPx - topPx - 1);
                return (
                  <div
                    key={seg.entityId}
                    style={{
                      display: 'flex',
                      position: 'absolute',
                      left: 0,
                      top: topPx,
                      width: BAR_WIDTH,
                      height: h,
                      background: MECHANISM_COLORS[mechanismFor(seg.charge)].fill,
                    }}
                  />
                );
              })}

              {/* Over-threshold shading (spec §5's "signature idea"), same three-band
                  logic as PayrollChart.tsx's shadeBands, computed per this bar's own
                  season thresholds. */}
              {tax > 0 && (
                <div
                  style={{
                    display: 'flex',
                    position: 'absolute',
                    left: 0,
                    top: yScale(Math.min(stack.total, thresholds.firstApron)),
                    width: BAR_WIDTH,
                    height: yScale(thresholds.taxLevel) - yScale(Math.min(stack.total, thresholds.firstApron)),
                    background: INK,
                    opacity: 0.18,
                  }}
                />
              )}
              {apron1 > 0 && (
                <div
                  style={{
                    display: 'flex',
                    position: 'absolute',
                    left: 0,
                    top: yScale(Math.min(stack.total, thresholds.secondApron)),
                    width: BAR_WIDTH,
                    height: yScale(thresholds.firstApron) - yScale(Math.min(stack.total, thresholds.secondApron)),
                    background: INK,
                    opacity: 0.32,
                  }}
                />
              )}
              {apron2 > 0 && (
                <div
                  style={{
                    display: 'flex',
                    position: 'absolute',
                    left: 0,
                    top: yScale(stack.total),
                    width: BAR_WIDTH,
                    height: yScale(thresholds.secondApron) - yScale(stack.total),
                    background: INK,
                    opacity: 0.5,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', flex: 1, alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 20 }}>
        <div style={{ display: 'flex', fontSize: 26, color: INK }}>{headline}</div>
        <div style={{ display: 'flex', fontSize: 18, color: SECONDARY }}>{SITE_HOST}</div>
      </div>
    </div>
  );
}
