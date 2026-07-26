// Pure label-placement math: no D3, no DOM. Callers pass already-computed
// pixel geometry (from the y-scale) and get back label positions. Kept
// dependency-free so M2's Vitest suite can exercise it directly.

export const LABEL_LINE_HEIGHT = 16;
export const LABEL_PADDING = 4;
export const INSIDE_LABEL_MIN_HEIGHT = LABEL_LINE_HEIGHT + LABEL_PADDING; // 20px
export const MAX_VISIBLE_CALLOUTS = 8;
// Rough monospace advance width at the 11px inside-label font size, used to
// decide whether a label fits a segment's width, not just its height — a
// segment can be tall enough for one line and still too narrow for its own
// text (e.g. a long charge label in a narrow band), which would otherwise
// overflow past the bar edge into the callout gutter.
export const APPROX_CHAR_WIDTH = 6.6;
export const INSIDE_LABEL_HORIZONTAL_PADDING = 8;

export type SegmentGeometry = {
  id: string;
  label: string;
  capHit: number;
  /** Pixel y of the segment's top edge (smaller value = higher on screen). */
  topPx: number;
  /** Pixel y of the segment's bottom edge. */
  bottomPx: number;
};

export type InsideLabel = {
  id: string;
  label: string;
  y: number;
};

export type Callout = {
  id: string;
  label: string;
  /** Vertical midpoint of the segment(s) this callout points at, pre-collision. */
  idealY: number;
  capHit: number;
  /** Present on a collapsed "Others (n)" callout. */
  mergedIds?: string[];
};

export type ResolvedCallout = Callout & { y: number };

/**
 * Step 1: inside label vs. outside callout, per spec §5 rule 1–2.
 * A segment gets an inside label once its pixel height clears one line of
 * text plus 4px of padding top and bottom *and* its own text fits the
 * segment's width; otherwise it needs a callout. `availableWidth` is
 * optional so callers without a meaningful width (e.g. a unit test probing
 * height logic in isolation) can omit it and get the height-only rule.
 */
export function classifySegments(
  segments: SegmentGeometry[],
  availableWidth?: number,
): { inside: InsideLabel[]; outside: Callout[] } {
  const inside: InsideLabel[] = [];
  const outside: Callout[] = [];

  for (const seg of segments) {
    const height = seg.bottomPx - seg.topPx;
    const midY = (seg.topPx + seg.bottomPx) / 2;
    const fitsWidth =
      availableWidth === undefined ||
      seg.label.length * APPROX_CHAR_WIDTH <= availableWidth - INSIDE_LABEL_HORIZONTAL_PADDING;

    if (height >= INSIDE_LABEL_MIN_HEIGHT && fitsWidth) {
      inside.push({ id: seg.id, label: seg.label, y: midY });
    } else {
      outside.push({ id: seg.id, label: seg.label, idealY: midY, capHit: seg.capHit });
    }
  }

  return { inside, outside };
}

/**
 * Step 4: once more than `maxVisible` segments need callouts, merge the
 * smallest ones (by capHit) into a single "Others (n)" callout so the
 * margin doesn't fill with unreadable tiny labels. The underlying bar
 * segments are untouched — only their callouts collapse. The merged
 * callout's ideal position is the capHit-weighted mean of its members, so
 * it lands near the cluster it summarizes.
 */
export function collapseSmallToOthers(
  callouts: Callout[],
  maxVisible: number = MAX_VISIBLE_CALLOUTS,
): Callout[] {
  if (callouts.length <= maxVisible) return callouts;

  const byValueDesc = [...callouts].sort((a, b) => b.capHit - a.capHit);
  const kept = byValueDesc.slice(0, maxVisible - 1);
  const merged = byValueDesc.slice(maxVisible - 1);

  const mergedCapHit = merged.reduce((sum, c) => sum + c.capHit, 0);
  const weightedY =
    merged.reduce((sum, c) => sum + c.idealY * c.capHit, 0) / mergedCapHit;

  const others: Callout = {
    id: 'others',
    label: `Others (${merged.length})`,
    idealY: weightedY,
    capHit: mergedCapHit,
    mergedIds: merged.map((c) => c.id),
  };

  return [...kept, others];
}

type Cluster = {
  /** Sum of the ideal Ys merged into this cluster, so sum / count is its center. */
  sum: number;
  count: number;
  /** Indices into the ascending-sorted callout array, in original order. */
  indices: number[];
};

function clusterCenter(c: Cluster): number {
  return c.sum / c.count;
}

/** Minimum gap two adjacent clusters' centers need once both are fully expanded. */
function requiredCenterGap(a: Cluster, b: Cluster, lineHeight: number): number {
  return (lineHeight * (a.count + b.count)) / 2;
}

/**
 * Step 3: resolve overlapping callouts with pool-adjacent-violators (PAVA) —
 * the standard isotonic-regression technique for "place points as close as
 * possible to their ideal value subject to a minimum-spacing constraint."
 * Sort by ideal y, then scan left to right maintaining a stack of clusters;
 * whenever the next point is closer to the top cluster's center than the
 * spacing both would need once expanded, merge them into one cluster
 * centered at their combined mean, repeating the merge check against the
 * (now shorter) stack. Each final cluster is then expanded into individual
 * positions evenly spaced by `lineHeight` around its own center.
 *
 * This is what makes a dense group settle symmetrically around the middle
 * of the cluster instead of cascading away from whichever end is processed
 * first — a plain forward-only or forward-then-backward sweep over a
 * pre-sorted array can only ever push in one direction, because by the time
 * the sweep reaches item i every earlier item already satisfies the spacing
 * constraint, so a later "push up" pass never finds anything left to do.
 *
 * Finally, if the whole resolved chain runs past the plot bounds, shift it
 * as a block — the internal `lineHeight` spacing from the clustering is
 * preserved, so a uniform shift can't reintroduce overlap.
 */
export function resolveCallouts(
  callouts: Callout[],
  bounds: { top: number; bottom: number },
  lineHeight: number = LABEL_LINE_HEIGHT,
): ResolvedCallout[] {
  if (callouts.length === 0) return [];

  const sorted = [...callouts].sort((a, b) => a.idealY - b.idealY);

  const stack: Cluster[] = [];
  for (let i = 0; i < sorted.length; i++) {
    let cluster: Cluster = { sum: sorted[i].idealY, count: 1, indices: [i] };

    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      const gap = clusterCenter(cluster) - clusterCenter(top);
      if (gap >= requiredCenterGap(top, cluster, lineHeight)) break;

      cluster = { sum: top.sum + cluster.sum, count: top.count + cluster.count, indices: [...top.indices, ...cluster.indices] };
      stack.pop();
    }

    stack.push(cluster);
  }

  const positions = new Array<number>(sorted.length);
  for (const cluster of stack) {
    const center = clusterCenter(cluster);
    const spread = (cluster.count - 1) / 2;
    cluster.indices.forEach((index, k) => {
      positions[index] = center + (k - spread) * lineHeight;
    });
  }

  const first = positions[0];
  const last = positions[positions.length - 1];
  let shift = 0;
  if (first < bounds.top) shift = bounds.top - first;
  else if (last > bounds.bottom) shift = bounds.bottom - last;
  if (shift !== 0) {
    for (let i = 0; i < positions.length; i++) positions[i] += shift;
  }

  return sorted.map((c, i) => ({ ...c, y: positions[i] }));
}
