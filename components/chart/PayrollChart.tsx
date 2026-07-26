'use client';

import { useMemo, useRef, useState } from 'react';
import type { Season, TeamPayrollData, SeasonThresholds, CapCharge } from '../../lib/types';
import { mechanismFor } from '../../lib/types';
import { buildStackOrder, stackSeason, type SeasonStack, type StackSegment } from '../../lib/chart/stack';
import { buildXScale, buildYScale } from '../../lib/chart/scales';
import {
  classifySegments,
  collapseSmallToOthers,
  resolveCallouts,
  type Callout,
  type InsideLabel,
  type ResolvedCallout,
  type SegmentGeometry,
} from '../../lib/chart/labels';
import { bandOverages } from '../../lib/chart/thresholds';
import { MECHANISM_COLORS, MECHANISM_LEGEND_ORDER } from '../../lib/chart/colors';
import { formatAbbreviated, formatExact, formatPercent, formatRetrievedAt } from '../../lib/format';
import { useContainerWidth } from '../../lib/chart/useContainerWidth';
import { SITE_HOST } from '../../lib/site';
import { PayrollTable } from './PayrollTable';
import {
  DEFAULT_TOGGLES,
  selectAmount,
  selectableCharges,
  toDisplayStack,
  toDisplayThresholds,
  thresholdsBySeasonMap,
  type ChartToggles,
} from '../../lib/chart/toggles';

// Both margins are ceilings, not fixed values — see `marginLeft`/`marginRight`
// below. A fixed margin sized for 1440px is most of a 390px viewport by
// itself; reserving it unconditionally overflowed the SVG's own bounds and
// silently clipped content. They scale with `width` instead, between MIN and
// MAX.
const MARGIN = { top: 32, bottom: 40, leftMax: 170, leftMin: 64, rightMax: 190, rightMin: 56 };
const MIN_PLOT_WIDTH = 140;
const PLOT_HEIGHT = 520;
const CALLOUT_STUB = 10;
const CALLOUT_ELBOW = 12;
const SEGMENT_GAP = 2;
// Opacity applied to every segment other than the active (hovered / focused
// / pinned) one, across every rendered season — the M1 fixed stack order's
// whole payoff (spec §6 item 1).
const DIMMED_OPACITY = 0.22;

const GRIDLINE = '#e1e0d9';
const MUTED_INK = '#898781';
const SECONDARY_INK = '#52514e';
const PRIMARY_INK = '#0b0b0b';

// Four distinct dash patterns (not just two "solid"s at different widths) so
// cap/tax/apron1/apron2 are told apart by line style alone, never by color —
// every threshold line uses the same ink (SECONDARY_INK). A width-only
// difference (the pre-M6 cap/tax pair) is too subtle to read at a glance.
const THRESHOLD_STYLE: Record<
  'salaryCap' | 'taxLevel' | 'firstApron' | 'secondApron',
  { name: string; dash: string; width: number }
> = {
  salaryCap: { name: 'Cap', dash: 'none', width: 1.5 },
  taxLevel: { name: 'Tax', dash: '1,3', width: 2 },
  firstApron: { name: 'Apron 1', dash: '6,3', width: 2 },
  secondApron: { name: 'Apron 2', dash: '2,3', width: 2.25 },
};
const THRESHOLD_KEYS = Object.keys(THRESHOLD_STYLE) as (keyof typeof THRESHOLD_STYLE)[];

type ShadeBand = { top: number; bottom: number; opacity: number };

// What hover/focus/pin all resolve to: enough to both highlight matching
// segments across seasons (by entityId) and drive the on-chart info
// readout, so the two can never show conflicting information. Carries the
// same provenance fields (spec §8: per-figure derivation + retrievedAt) the
// segment's own <title>/aria-label expose, so the sighted-user readout below
// never shows less than what a screen reader or mouse tooltip already gets.
type ActiveSegmentInfo = {
  entityId: string;
  label: string;
  amount: number;
  season: Season;
  derivation: CapCharge['derivation'];
  sourceId: string;
  retrievedAt: string;
};

// Per-figure provenance (spec §8), in one place so the segment's <title>,
// its aria-label, and the sighted-user readout can't drift into describing
// derivation differently from each other or from /methodology's own wording.
function derivationPhrase(charge: Pick<CapCharge, 'derivation' | 'sourceId'>): string {
  switch (charge.derivation) {
    case 'sourced':
      return `sourced from ${charge.sourceId}`;
    case 'computed':
      return 'computed by the CBA rules engine';
    case 'estimated':
      return 'estimated — see methodology';
    case 'synthetic':
      return 'synthetic placeholder data';
  }
}

const MONO_FONT_STACK = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';

/**
 * Download-PNG button (spec §10 item 2): serializes the live, already-
 * rendered chart <svg> — same DOM the user is looking at, not a second
 * render path — onto an offscreen canvas and triggers a download. Tailwind's
 * `font-mono` class on the <svg> root only takes effect via the page's own
 * stylesheet, which a standalone serialized SVG document doesn't have access
 * to, so an inline <style> is injected into the clone to keep the exported
 * PNG's numerals monospace rather than silently falling back to a serif
 * default. The site's own host is watermarked in the bottom-right corner —
 * unobtrusive, but present on every export, so a screenshot that circulates
 * still carries attribution (spec's stated reason for this feature).
 */
function downloadChartAsPng(svgEl: SVGSVGElement, filename: string) {
  const width = Number(svgEl.getAttribute('width')) || svgEl.clientWidth;
  const height = Number(svgEl.getAttribute('height')) || svgEl.clientHeight;
  if (!width || !height) return;

  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));

  const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  styleEl.textContent = `text { font-family: ${MONO_FONT_STACK}; }`;
  clone.insertBefore(styleEl, clone.firstChild);

  const watermark = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  watermark.setAttribute('x', String(width - 10));
  watermark.setAttribute('y', String(height - 10));
  watermark.setAttribute('text-anchor', 'end');
  watermark.setAttribute('font-size', '11');
  watermark.setAttribute('fill', '#898781');
  watermark.textContent = SITE_HOST;
  clone.appendChild(watermark);

  const svgString = new XMLSerializer().serializeToString(clone);
  const svgUrl = URL.createObjectURL(new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' }));

  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(svgUrl);
    const scale = 2; // crisper export than 1:1 CSS pixels
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(scale, scale);
    ctx.fillStyle = '#f9f9f7';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(blobUrl);
    }, 'image/png');
  };
  img.src = svgUrl;
}

type SeasonRender = {
  season: Season;
  /** Real, sourced dollar thresholds — used for the exact tooltip text and
   * for deciding whether a total actually crosses a line (basis-aware, but
   * never itself toggle-scaled: see lib/chart/toggles.ts). */
  thresholds: SeasonThresholds;
  /** Same thresholds, percent-of-cap-scaled when dollarMode is 'percent' —
   * used for anything that goes through the (display-unit) yScale. */
  displayThresholds: SeasonThresholds;
  /** Real-dollar stack (basis + guaranteed-only applied) — source of the
   * per-segment exact dollar amount and the overage booleans. */
  stack: SeasonStack;
  /** Display-unit stack (additionally percent-scaled when applicable) — source of all pixel geometry. */
  displayStack: SeasonStack;
  barX: number;
  barWidth: number;
  /** Horizontal room for this band's gap callout text before it would reach the next
   * band. Only meaningful for a non-last season — the last season's callouts live in
   * the right margin instead (see `marginRightAvailableWidth`). */
  calloutMaxWidth: number;
  inside: InsideLabel[];
  outside: Callout[];
  resolvedById: Map<string, ResolvedCallout>;
  shadeBands: ShadeBand[];
};

export function PayrollChart({
  fixture,
  focusSeason,
  seasons: seasonsFilter,
  toggles = DEFAULT_TOGGLES,
  pinnedEntityId = null,
  onPinChange,
}: {
  fixture: TeamPayrollData;
  focusSeason?: Season;
  /** Restrict rendering to this subset of `fixture`'s seasons (e.g. a season
   * range picked on /team/[slug], or a single season for /team/[slug]/[season]).
   * Defaults to every season in `fixture.thresholds`. */
  seasons?: Season[];
  /** The toggle set from spec §6. Owned by the URL (TeamPageClient); this
   * component only ever reads it. */
  toggles?: ChartToggles;
  /** The pinned entity, if any — owned by the URL (TeamPageClient). Hover
   * and keyboard focus are this component's own ephemeral state and are
   * never lifted, since neither belongs in a shareable link. */
  pinnedEntityId?: string | null;
  onPinChange?: (entityId: string | null) => void;
}) {
  const { ref, width } = useContainerWidth<HTMLDivElement>(960);
  // The chart's non-visual equivalent (spec §9 / CLAUDE.md: "every chart
  // ships with a table equivalent"): a visible toggle that swaps the whole
  // SVG for an accessible <table> of the same (toggle-filtered) data, rather
  // than an offscreen table living alongside it — one structure for a
  // screen reader to traverse at a time.
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [expandedOthers, setExpandedOthers] = useState<Record<string, boolean>>({});
  const [hoveredSegment, setHoveredSegment] = useState<ActiveSegmentInfo | null>(null);
  const [focusedSegment, setFocusedSegment] = useState<ActiveSegmentInfo | null>(null);
  // A mouse click both pins a segment (togglePin) and, as a normal DOM side
  // effect of clicking a focusable element, leaves it natively focused —
  // without this, that lingering focus would keep driving the highlight via
  // focusedSegment even after the click's own hover ends and even after a
  // second click unpins it, since browsers don't blur an element on a click
  // elsewhere that doesn't itself receive focus. Mirrors the same
  // mouse-vs-keyboard distinction :focus-visible already makes for the ring
  // styling below, so a mouse click's focus never drives the readout/dim,
  // only real keyboard (Tab) focus does.
  const suppressNextFocusRef = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const seasons = useMemo(() => {
    const all = [...fixture.thresholds].sort((a, b) => a.season.localeCompare(b.season)).map((t) => t.season);
    if (!seasonsFilter) return all;
    const allowed = new Set(seasonsFilter);
    return all.filter((s) => allowed.has(s));
  }, [fixture.thresholds, seasonsFilter]);
  const firstSeason = seasons[0];
  const lastSeason = seasons[seasons.length - 1];
  const resolvedFocusSeason = focusSeason && seasons.includes(focusSeason) ? focusSeason : lastSeason;
  const thresholdsBySeason = useMemo(
    () => new Map(fixture.thresholds.map((t) => [t.season, t])),
    [fixture.thresholds],
  );

  // Toggle-filtered charges feed both the stack order and every season's
  // stack: dead-money/hold exclusion and guaranteed-only's zero-amount drop
  // both happen once, here, rather than at each call site.
  const eligibleCharges = useMemo(
    () => selectableCharges(fixture.capCharges, toggles),
    [fixture.capCharges, toggles],
  );
  const getAmount = useMemo(() => (charge: CapCharge) => selectAmount(charge, toggles), [toggles]);

  const order = useMemo(
    () => buildStackOrder(eligibleCharges, resolvedFocusSeason, getAmount),
    [eligibleCharges, resolvedFocusSeason, getAmount],
  );
  // Real-dollar stacks (basis + guaranteed-only applied, never percent-scaled)
  // — the ground truth for tooltips and for whether a total actually crosses
  // a threshold line.
  const stacks = useMemo(
    () => seasons.map((season) => stackSeason(eligibleCharges, season, order, getAmount)),
    [seasons, eligibleCharges, order, getAmount],
  );

  // Scales with the container so marginLeft + plotWidth + marginRight never
  // exceeds `width` — that invariant is what keeps the SVG's own bounds from
  // clipping content at narrow widths.
  const marginLeft = Math.max(MARGIN.leftMin, Math.min(MARGIN.leftMax, width * 0.2));
  const marginRight = Math.max(MARGIN.rightMin, Math.min(MARGIN.rightMax, width * 0.22));
  const plotWidth = Math.max(width - marginLeft - marginRight, MIN_PLOT_WIDTH);
  const marginLeftAvailableWidth = Math.max(20, marginLeft - CALLOUT_STUB - CALLOUT_ELBOW - 10);
  const marginRightAvailableWidth = Math.max(20, marginRight - CALLOUT_STUB - CALLOUT_ELBOW - 10);

  const xScale = useMemo(() => buildXScale(seasons, plotWidth), [seasons, plotWidth]);
  // Scale built only from the seasons actually being rendered — a season
  // outside the current range (e.g. filtered out by seasons/seasonsFilter)
  // shouldn't stretch the axis for one that's on screen.
  const renderedThresholds = useMemo(
    () => seasons.map((s) => thresholdsBySeason.get(s)).filter((t): t is SeasonThresholds => !!t),
    [seasons, thresholdsBySeason],
  );
  const renderedDisplayThresholds = useMemo(
    () => toDisplayThresholds(renderedThresholds, toggles.dollarMode),
    [renderedThresholds, toggles.dollarMode],
  );
  const displayThresholdsBySeason = useMemo(
    () => thresholdsBySeasonMap(renderedDisplayThresholds),
    [renderedDisplayThresholds],
  );
  const displayStacks = useMemo(
    () =>
      stacks.map((stack) => {
        const t = thresholdsBySeason.get(stack.season);
        return t ? toDisplayStack(stack, t, toggles.dollarMode) : stack;
      }),
    [stacks, thresholdsBySeason, toggles.dollarMode],
  );
  // One scale, built from every rendered season's stacks and thresholds
  // together, so a given threshold sits at the same height regardless of
  // which season's margin it's labeled in, and the bars stay honestly
  // comparable. Operates entirely in display units (dollars, or % of cap).
  const yScale = useMemo(
    () => buildYScale(displayStacks, renderedDisplayThresholds, PLOT_HEIGHT),
    [displayStacks, renderedDisplayThresholds],
  );
  const formatValue = toggles.dollarMode === 'percent' ? formatPercent : formatAbbreviated;

  // All per-season geometry and label layout computed once, up front, so the
  // render below can do clean passes over the same data: every bar fill
  // first, then every line/label on top. That ordering guarantees a callout
  // can never be visually covered by a later season's bar.
  const seasonRenders: SeasonRender[] = useMemo(
    () =>
      seasons.flatMap((season, seasonIndex) => {
        const thresholds = thresholdsBySeason.get(season);
        const displayThresholds = displayThresholdsBySeason.get(season);
        if (!thresholds || !displayThresholds) return [];
        const stack = stacks[seasonIndex];
        const displayStack = displayStacks[seasonIndex];

        const barX = xScale(season) ?? 0;
        const barWidth = xScale.bandwidth();
        const nextBarX = xScale(seasons[seasonIndex + 1]);
        const calloutOrigin = barX + barWidth + CALLOUT_STUB + CALLOUT_ELBOW + 4;
        const calloutMaxWidth = Math.max(20, (nextBarX ?? calloutOrigin) - calloutOrigin - 6);

        const segmentGeometries: SegmentGeometry[] = displayStack.segments.map((seg) => ({
          id: seg.entityId,
          label: seg.charge.label,
          capHit: seg.top - seg.bottom,
          topPx: yScale(seg.top),
          bottomPx: yScale(seg.bottom),
        }));
        const { inside, outside: outsideRaw } = classifySegments(segmentGeometries, barWidth);
        const outside = expandedOthers[season] ? outsideRaw : collapseSmallToOthers(outsideRaw);
        const resolved = resolveCallouts(outside, { top: 0, bottom: PLOT_HEIGHT });
        const resolvedById = new Map(resolved.map((c) => [c.id, c]));

        // Overage — did the team's real (basis-selected) dollar total
        // actually cross this line — is always computed off real dollars,
        // never the percent-scaled display stack: scaling both sides of a
        // ">" comparison by the same positive factor can't change the
        // answer, so this is just the simpler, more legible form.
        const overages = bandOverages(stack.total, thresholds);
        const apron1Overage = overages.find((o) => o.key === 'apron1')!.overage;
        const apron2Overage = overages.find((o) => o.key === 'apron2')!.overage;
        const taxOverage = overages.find((o) => o.key === 'tax')!.overage;

        const shadeBands: ShadeBand[] = [];
        if (taxOverage > 0) {
          shadeBands.push({
            bottom: displayThresholds.taxLevel,
            top: Math.min(displayStack.total, displayThresholds.firstApron),
            opacity: 0.18,
          });
        }
        if (apron1Overage > 0) {
          shadeBands.push({
            bottom: displayThresholds.firstApron,
            top: Math.min(displayStack.total, displayThresholds.secondApron),
            opacity: 0.32,
          });
        }
        if (apron2Overage > 0) {
          shadeBands.push({ bottom: displayThresholds.secondApron, top: displayStack.total, opacity: 0.5 });
        }

        return [
          {
            season,
            thresholds,
            displayThresholds,
            stack,
            displayStack,
            barX,
            barWidth,
            calloutMaxWidth,
            inside,
            outside,
            resolvedById,
            shadeBands,
          },
        ];
      }),
    [
      seasons,
      stacks,
      displayStacks,
      thresholdsBySeason,
      displayThresholdsBySeason,
      xScale,
      yScale,
      expandedOthers,
    ],
  );

  const firstRender = seasonRenders.find((r) => r.season === firstSeason)!;
  const lastRender = seasonRenders.find((r) => r.season === lastSeason)!;

  // Threshold "callouts" for the margin beside a given season's bar, shaped
  // like a player Callout so they can share the same collision-resolution
  // pass as real player labels where the two coexist (the right margin,
  // where the last season's small-segment callouts also live).
  const thresholdCallouts = (r: SeasonRender): Callout[] =>
    THRESHOLD_KEYS.map((key) => ({
      id: `threshold-${key}`,
      label: `${THRESHOLD_STYLE[key].name} ${formatValue(r.displayThresholds[key])}${r.thresholds.isProjected ? ' (proj.)' : ''}`,
      idealY: yScale(r.displayThresholds[key]),
      capHit: Number.MAX_SAFE_INTEGER,
    }));

  // Left margin: only the first season's threshold lines live here — nothing
  // else competes for the space, since every season's player callouts sit to
  // the right of their own bar.
  const leftMarginResolved = useMemo(
    () => resolveCallouts(thresholdCallouts(firstRender), { top: 0, bottom: PLOT_HEIGHT }),
    [firstRender, yScale],
  );
  // resolveCallouts sorts its output by idealY, so look up by id rather than
  // assuming it comes back in THRESHOLD_KEYS order.
  const leftMarginById = useMemo(
    () => new Map(leftMarginResolved.map((r) => [r.id, r])),
    [leftMarginResolved],
  );

  // Right margin: the last season's threshold lines *and* its small-segment
  // callouts both land here, so they're resolved together in one pass —
  // otherwise a threshold line and a player callout could still collide even
  // though each was individually collision-free within its own set.
  const rightMarginResolved = useMemo(
    () => resolveCallouts([...thresholdCallouts(lastRender), ...lastRender.outside], { top: 0, bottom: PLOT_HEIGHT }),
    [lastRender, yScale],
  );

  const svgHeight = MARGIN.top + PLOT_HEIGHT + MARGIN.bottom;
  const yTicks = yScale.ticks(6);

  // Non-last seasons keep their own gap-based callouts (existing behavior,
  // unchanged); the last season's callouts move into rightMarginResolved
  // above, merged with its threshold lines.
  const gapCalloutSeasons = seasonRenders.filter((r) => r.season !== lastSeason);

  // Hover and focus both temporarily preview a segment; releasing either
  // falls back to whatever's pinned, so a pinned selection survives normal
  // hover exploration elsewhere on the chart instead of being clobbered by
  // it. This single value drives both the cross-season highlight and the
  // info readout, so the two can never disagree (see NOTES.md M5 entry).
  const pinnedInfo = useMemo(() => {
    if (!pinnedEntityId) return null;
    // Prefer the focus season's own instance of the pinned entity; fall back
    // to the first season (chronological, since `stacks` follows `seasons`)
    // it appears in otherwise — e.g. a player pinned in a season range that
    // doesn't include the current focus season.
    const focusStack = stacks.find((s) => s.season === resolvedFocusSeason);
    const focusSeg = focusStack?.segments.find((s) => s.entityId === pinnedEntityId);
    if (focusSeg) return segmentInfoFor(focusSeg, resolvedFocusSeason, getAmount);

    for (const s of stacks) {
      const seg = s.segments.find((sg) => sg.entityId === pinnedEntityId);
      if (seg) return segmentInfoFor(seg, s.season, getAmount);
    }
    return null;
  }, [pinnedEntityId, stacks, resolvedFocusSeason, getAmount]);

  const activeInfo = hoveredSegment ?? focusedSegment ?? pinnedInfo;
  const activeEntityId = activeInfo?.entityId ?? null;

  function togglePin(entityId: string) {
    onPinChange?.(pinnedEntityId === entityId ? null : entityId);
  }

  return (
    <div ref={ref} className="w-full">
      <Legend />
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={viewMode === 'table'}
          onClick={() => setViewMode((m) => (m === 'chart' ? 'table' : 'chart'))}
          className="rounded border border-[#d8d6cf] bg-white px-2.5 py-1 text-xs text-[#0b0b0b] hover:bg-[#f0efe9]"
        >
          {viewMode === 'chart' ? 'View as table' : 'View as chart'}
        </button>
        {viewMode === 'chart' && (
          <button
            type="button"
            onClick={() => svgRef.current && downloadChartAsPng(svgRef.current, `${fixture.teamId}-payroll-${seasons.join('-')}.png`)}
            className="rounded border border-[#d8d6cf] bg-white px-2.5 py-1 text-xs text-[#0b0b0b] hover:bg-[#f0efe9]"
          >
            Download PNG
          </button>
        )}
      </div>

      {viewMode === 'table' ? (
        <PayrollTable
          teamLabel={fixture.teamLabel}
          seasons={seasons}
          stacks={stacks}
          thresholdsBySeason={thresholdsBySeason}
          toggles={toggles}
        />
      ) : (
        <>
          <ActiveSegmentReadout info={activeInfo} />
          <svg
        ref={svgRef}
        width={width}
        height={svgHeight}
        // graphics-document (ARIA Graphics Module), not img: img forbids
        // focusable descendants, but this chart's segments and "Others"
        // control are individually focusable (spec §6/§9 keyboard nav) —
        // axe-core's nested-interactive rule confirmed role="img" was a real
        // violation, not a style choice.
        role="graphics-document"
        aria-label={`Payroll stack for ${fixture.teamLabel}, seasons ${seasons.join(' and ')}`}
        className="font-mono"
        onClick={() => onPinChange?.(null)}
      >
        <g transform={`translate(${marginLeft},${MARGIN.top})`}>
          {yTicks.map((tick) => (
            <g key={tick}>
              <line x1={0} x2={plotWidth} y1={yScale(tick)} y2={yScale(tick)} stroke={GRIDLINE} strokeWidth={1} />
              <text
                x={-10}
                y={yScale(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={10}
                fill={SECONDARY_INK}
              >
                {formatValue(tick)}
              </text>
            </g>
          ))}

          {/* Pass 1: every bar's fills and shading — no lines, no text.
              Segments render in reverse stack order (visually top-to-bottom:
              the largest earner sits at dollar-0, the bottom of the bar, so
              the *last* entry in stack order is the topmost segment on
              screen) so the natural DOM/tab order matches spec §6 item 4
              ("top to bottom within a bar, then to the next bar") without
              resorting to explicit tabIndex ordering. Paint order doesn't
              matter here — segments don't overlap. */}
          {seasonRenders.map((r) => (
            <g key={r.season}>
              {[...r.displayStack.segments].reverse().map((seg) => {
                const colors = MECHANISM_COLORS[mechanismFor(seg.charge)];
                const topPx = yScale(seg.top);
                const bottomPx = yScale(seg.bottom);
                const rawHeight = bottomPx - topPx;
                const gap = rawHeight > SEGMENT_GAP * 2 + 2 ? SEGMENT_GAP : 0;
                const isActive = activeEntityId === seg.entityId;
                const isDimmed = activeEntityId !== null && !isActive;
                const dollarAmount = getAmount(seg.charge);

                return (
                  <rect
                    key={seg.entityId}
                    x={r.barX}
                    y={topPx + gap / 2}
                    width={r.barWidth}
                    height={Math.max(0, rawHeight - gap)}
                    fill={colors.fill}
                    opacity={isDimmed ? DIMMED_OPACITY : 1}
                    stroke={isActive ? PRIMARY_INK : 'none'}
                    strokeWidth={isActive ? 2 : 0}
                    tabIndex={0}
                    role="graphics-symbol"
                    aria-label={`${seg.charge.label}, ${formatExact(dollarAmount)}, ${r.season}, ${derivationPhrase(seg.charge)}, retrieved ${formatRetrievedAt(seg.charge.retrievedAt)}`}
                    className="outline-none focus-visible:stroke-black focus-visible:stroke-2 cursor-pointer"
                    onMouseEnter={() => setHoveredSegment(segmentInfoFor(seg, r.season, getAmount))}
                    onMouseLeave={() => setHoveredSegment(null)}
                    onMouseDown={() => {
                      suppressNextFocusRef.current = true;
                    }}
                    onFocus={() => {
                      if (suppressNextFocusRef.current) {
                        suppressNextFocusRef.current = false;
                        return;
                      }
                      setFocusedSegment(segmentInfoFor(seg, r.season, getAmount));
                    }}
                    onBlur={() => setFocusedSegment(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePin(seg.entityId);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        togglePin(seg.entityId);
                      }
                    }}
                  >
                    <title>{`${seg.charge.label} — ${formatExact(dollarAmount)} (${r.season}) — ${derivationPhrase(seg.charge)}, retrieved ${formatRetrievedAt(seg.charge.retrievedAt)}`}</title>
                  </rect>
                );
              })}

              {/* Over-threshold shading — the signature idea (spec §5): the portion of
                  the bar above the tax line is tinted, intensifying above each apron. */}
              {r.shadeBands.map((band, i) => (
                <rect
                  key={i}
                  x={r.barX}
                  y={yScale(band.top)}
                  width={r.barWidth}
                  height={Math.max(0, yScale(band.bottom) - yScale(band.top))}
                  fill={PRIMARY_INK}
                  opacity={band.opacity}
                  pointerEvents="none"
                />
              ))}
            </g>
          ))}

          {/* Pass 2: threshold lines + labels, confined to the margin beside their own
              bar — never crossing a bar's fill or another label (matches the reference
              graphic, not spec §5's literal "full plot width" reading, which put a line
              from a season neither bar's edge belongs to on top of the other season's
              segments — see NOTES.md). Each line's stub starts exactly at the bar edge
              at its true y; only the label (and the elbow leading to it) may shift to
              avoid a collision. */}
          {THRESHOLD_KEYS.map((key) => {
            const style = THRESHOLD_STYLE[key];
            const resolved = leftMarginById.get(`threshold-${key}`)!;
            return (
              <MarginLabel
                key={`left-${key}`}
                originX={firstRender.barX}
                trueY={yScale(firstRender.displayThresholds[key])}
                resolvedY={resolved.y}
                direction="left"
                text={truncateToWidth(resolved.label, marginLeftAvailableWidth)}
                title={`${firstSeason} ${style.name}: ${formatExact(firstRender.thresholds[key])}${firstRender.thresholds.isProjected ? ' (projected)' : ''}`}
                stroke={SECONDARY_INK}
                strokeWidth={style.width}
                dash={style.dash === 'none' ? undefined : style.dash}
              />
            );
          })}

          {rightMarginResolved.map((item) => {
            const isThreshold = item.id.startsWith('threshold-');
            const key = isThreshold ? (item.id.replace('threshold-', '') as keyof typeof THRESHOLD_STYLE) : null;
            const style = key ? THRESHOLD_STYLE[key] : null;
            const isOthers = item.id === 'others';
            const trueY = isThreshold ? yScale(lastRender.displayThresholds[key!]) : item.idealY;

            return (
              <MarginLabel
                key={`right-${item.id}`}
                originX={lastRender.barX + lastRender.barWidth}
                trueY={trueY}
                resolvedY={item.y}
                direction="right"
                text={
                  isThreshold
                    ? truncateToWidth(item.label, marginRightAvailableWidth)
                    : calloutText(item.label, item.capHit, marginRightAvailableWidth, formatValue)
                }
                title={
                  isThreshold
                    ? `${lastSeason} ${style!.name}: ${formatExact(lastRender.thresholds[key!])}${lastRender.thresholds.isProjected ? ' (projected)' : ''}`
                    : item.label
                }
                stroke={isThreshold ? SECONDARY_INK : MUTED_INK}
                strokeWidth={isThreshold ? style!.width : 1}
                dash={isThreshold && style!.dash !== 'none' ? style!.dash : undefined}
                onActivate={
                  isOthers ? () => setExpandedOthers((s) => ({ ...s, [lastSeason]: true })) : undefined
                }
                ariaExpanded={isOthers ? expandedOthers[lastSeason] ?? false : undefined}
              />
            );
          })}

          {/* Pass 3: inside labels, non-last-season gap callouts, axis text. */}
          {seasonRenders.map((r) => (
            <g key={r.season}>
              {r.displayStack.segments.map((seg) => {
                const colors = MECHANISM_COLORS[mechanismFor(seg.charge)];
                const insideLabel = r.inside.find((l) => l.id === seg.entityId);
                if (!insideLabel) return null;
                const isDimmed = activeEntityId !== null && activeEntityId !== seg.entityId;
                return (
                  <text
                    key={seg.entityId}
                    x={r.barX + r.barWidth / 2}
                    y={insideLabel.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={11}
                    fill={colors.textColor}
                    opacity={isDimmed ? DIMMED_OPACITY : 1}
                    pointerEvents="none"
                  >
                    {seg.charge.label}
                  </text>
                );
              })}

              <text
                x={r.barX + r.barWidth / 2}
                y={PLOT_HEIGHT + 20}
                textAnchor="middle"
                fontSize={13}
                fill={PRIMARY_INK}
              >
                {r.season}
                {r.thresholds.isProjected ? ' (projected)' : ''}
              </text>
            </g>
          ))}

          {gapCalloutSeasons.map((r) => (
            <g key={r.season}>
              {r.outside.map((callout) => {
                const resolvedCallout = r.resolvedById.get(callout.id);
                if (!resolvedCallout) return null;
                const isOthers = callout.id === 'others';
                return (
                  <MarginLabel
                    key={callout.id}
                    originX={r.barX + r.barWidth}
                    trueY={callout.idealY}
                    resolvedY={resolvedCallout.y}
                    direction="right"
                    text={calloutText(callout.label, callout.capHit, r.calloutMaxWidth, formatValue)}
                    title={callout.label}
                    stroke={MUTED_INK}
                    strokeWidth={1}
                    onActivate={
                      isOthers ? () => setExpandedOthers((s) => ({ ...s, [r.season]: true })) : undefined
                    }
                    ariaExpanded={isOthers ? expandedOthers[r.season] ?? false : undefined}
                  />
                );
              })}
            </g>
          ))}
        </g>
          </svg>
        </>
      )}
    </div>
  );
}

function segmentInfoFor(
  seg: StackSegment,
  season: Season,
  getAmount: (charge: CapCharge) => number,
): ActiveSegmentInfo {
  return {
    entityId: seg.entityId,
    label: seg.charge.label,
    amount: getAmount(seg.charge),
    season,
    derivation: seg.charge.derivation,
    sourceId: seg.charge.sourceId,
    retrievedAt: seg.charge.retrievedAt,
  };
}

// Sighted-user equivalent of what a screen reader already gets from a
// segment's aria-label on hover/focus — dedicated readout so keyboard users
// get the same visible info a mouse user sees via the native <title>
// tooltip, without waiting on M6's full accessibility pass. aria-hidden
// because the underlying aria-label already announces this on focus; this
// is a visual affordance, not a second announcement.
function ActiveSegmentReadout({ info }: { info: ActiveSegmentInfo | null }) {
  return (
    <div className="mb-2 min-h-[1.25rem] text-sm text-[#0b0b0b]" aria-hidden="true">
      {info
        ? `${info.label} — ${formatExact(info.amount)} (${info.season}) · ${derivationPhrase(info)} · retrieved ${formatRetrievedAt(info.retrievedAt)}`
        : ' '}
    </div>
  );
}

// A leader line (stub from the bar edge at the item's true position, then an
// elbow to wherever collision resolution moved the label) plus its text.
// Shared by threshold lines (either margin) and player callouts (gap or
// right margin) — direction mirrors the geometry for a left- vs right-hand
// margin; only the label position (and the elbow leading to it) ever moves,
// never the stub's starting point, which stays pinned to the real value.
function MarginLabel({
  originX,
  trueY,
  resolvedY,
  direction,
  text,
  title,
  stroke,
  strokeWidth,
  dash,
  onActivate,
  ariaExpanded,
}: {
  originX: number;
  trueY: number;
  resolvedY: number;
  direction: 'left' | 'right';
  text: string;
  title: string;
  stroke: string;
  strokeWidth: number;
  dash?: string;
  onActivate?: () => void;
  ariaExpanded?: boolean;
}) {
  const sign = direction === 'left' ? -1 : 1;
  const stubEndX = originX + sign * CALLOUT_STUB;
  const elbowEndX = stubEndX + sign * CALLOUT_ELBOW;
  const labelX = elbowEndX + sign * 4;

  return (
    <g>
      <path
        d={`M ${originX} ${trueY} L ${stubEndX} ${trueY} L ${elbowEndX} ${resolvedY}`}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={dash}
        fill="none"
      />
      <text
        x={labelX}
        y={resolvedY}
        textAnchor={direction === 'left' ? 'end' : 'start'}
        dominantBaseline="middle"
        fontSize={onActivate ? 10 : 9}
        fill={SECONDARY_INK}
        onClick={onActivate}
        style={onActivate ? { cursor: 'pointer', textDecoration: 'underline' } : undefined}
        tabIndex={onActivate ? 0 : undefined}
        role={onActivate ? 'button' : undefined}
        aria-expanded={ariaExpanded}
        onKeyDown={
          onActivate
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') onActivate();
              }
            : undefined
        }
      >
        <title>{title}</title>
        {text}
      </text>
    </g>
  );
}

// Monospace advance-width estimate at the 9-10px label font sizes used in the margins.
const CALLOUT_CHAR_WIDTH = 6;

function truncateToWidth(text: string, maxWidth: number): string {
  const maxChars = Math.max(1, Math.floor(maxWidth / CALLOUT_CHAR_WIDTH));
  if (text.length <= maxChars) return text;
  return text.slice(0, Math.max(1, maxChars - 1)) + '…';
}

// Builds the compact "Label · $XM" (or "Label · 132%") callout string,
// stripping a trailing parenthetical ("(stretched)", "(pending FA)") and
// then truncating with an ellipsis if it still won't fit the available
// width — the full label is always still on the callout's own <title>
// tooltip. `formatValue` is dollarMode-aware (formatAbbreviated or
// formatPercent) so callouts stay consistent with the axis/threshold labels.
function calloutText(label: string, amount: number, maxWidth: number, formatValue: (n: number) => string): string {
  const suffix = ` · ${formatValue(amount)}`;
  const stripped = label.replace(/\s*\([^)]*\)\s*$/, '');
  const maxChars = Math.max(1, Math.floor(maxWidth / CALLOUT_CHAR_WIDTH));

  const full = stripped + suffix;
  if (full.length <= maxChars) return full;

  const room = maxChars - suffix.length - 1; // 1 for the ellipsis
  if (room <= 0) return full.slice(0, Math.max(1, maxChars - 1)) + '…';
  return stripped.slice(0, room) + '…' + suffix;
}

function Legend() {
  return (
    <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#52514e]" aria-label="Color legend">
      {MECHANISM_LEGEND_ORDER.map((mechanism) => (
        <li key={mechanism} className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ backgroundColor: MECHANISM_COLORS[mechanism].fill }}
            aria-hidden="true"
          />
          {MECHANISM_COLORS[mechanism].label}
        </li>
      ))}
    </ul>
  );
}
