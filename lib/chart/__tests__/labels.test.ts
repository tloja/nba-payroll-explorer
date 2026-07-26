import { describe, expect, it } from 'vitest';
import {
  classifySegments,
  collapseSmallToOthers,
  resolveCallouts,
  LABEL_LINE_HEIGHT,
  MAX_VISIBLE_CALLOUTS,
  type Callout,
  type SegmentGeometry,
} from '../labels';

function seg(id: string, label: string, topPx: number, bottomPx: number, capHit = 1_000_000): SegmentGeometry {
  return { id, label, capHit, topPx, bottomPx };
}

function callout(id: string, idealY: number, capHit = 1_000_000): Callout {
  return { id, label: id, idealY, capHit };
}

describe('classifySegments', () => {
  it('places a tall, wide-enough segment as an inside label', () => {
    const { inside, outside } = classifySegments([seg('a', 'Short', 0, 40)], 200);
    expect(inside).toEqual([{ id: 'a', label: 'Short', y: 20 }]);
    expect(outside).toHaveLength(0);
  });

  it('pushes a short segment to an outside callout', () => {
    const { inside, outside } = classifySegments([seg('a', 'Short', 0, 10)], 200);
    expect(inside).toHaveLength(0);
    expect(outside).toEqual([{ id: 'a', label: 'Short', idealY: 5, capHit: 1_000_000 }]);
  });

  it('pushes a tall-enough-but-too-narrow segment to an outside callout', () => {
    // 40px tall clears the height rule, but a 24-char label can't fit 20px
    // of available width — the width check must independently gate this.
    const { inside, outside } = classifySegments([seg('a', 'A Very Long Player Name', 0, 40)], 20);
    expect(inside).toHaveLength(0);
    expect(outside).toHaveLength(1);
  });

  it('applies the height-only rule when availableWidth is omitted', () => {
    const { inside } = classifySegments([seg('a', 'A Very Long Player Name', 0, 40)]);
    expect(inside).toHaveLength(1);
  });
});

describe('collapseSmallToOthers', () => {
  it('leaves callouts untouched at or under the max-visible threshold', () => {
    const callouts = Array.from({ length: MAX_VISIBLE_CALLOUTS }, (_, i) => callout(`c${i}`, i * 10, i + 1));
    expect(collapseSmallToOthers(callouts)).toEqual(callouts);
  });

  it('collapses the smallest-by-capHit callouts into a single "Others (n)" once over the threshold', () => {
    // 10 callouts, capHit descending 10..1 as idealY ascends 0..90 — the
    // maxVisible=8 threshold should keep the 7 largest and merge the rest.
    const callouts = Array.from({ length: 10 }, (_, i) => callout(`c${i}`, i * 10, 10 - i));
    const result = collapseSmallToOthers(callouts, 8);

    expect(result).toHaveLength(8);
    expect(result.slice(0, 7).map((c) => c.id)).toEqual(['c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6']);

    const others = result[7];
    expect(others.id).toBe('others');
    expect(others.label).toBe('Others (3)');
    expect(others.mergedIds).toEqual(['c7', 'c8', 'c9']);
    expect(others.capHit).toBe(3 + 2 + 1);
    // capHit-weighted mean of the merged cluster's ideal Ys: (70*3+80*2+90*1)/6
    expect(others.idealY).toBeCloseTo(460 / 6, 5);
  });

  it('is a no-op when nothing needs collapsing even with a custom maxVisible', () => {
    const callouts = [callout('a', 0), callout('b', 10)];
    expect(collapseSmallToOthers(callouts, 8)).toEqual(callouts);
  });
});

describe('resolveCallouts', () => {
  it('returns an empty array for no callouts', () => {
    expect(resolveCallouts([], { top: 0, bottom: 500 })).toEqual([]);
  });

  it('leaves already-well-spaced callouts at their ideal position (no collisions)', () => {
    const callouts = [callout('a', 0), callout('b', 40), callout('c', 80)];
    const resolved = resolveCallouts(callouts, { top: -1000, bottom: 1000 });
    expect(resolved.map((c) => ({ id: c.id, y: c.y }))).toEqual([
      { id: 'a', y: 0 },
      { id: 'b', y: 40 },
      { id: 'c', y: 80 },
    ]);
  });

  it('settles a dense cluster of identical-idealY callouts symmetrically around their shared center', () => {
    // Five callouts stacked on the same pixel. PAVA must fan them out with
    // no overlap, at least LABEL_LINE_HEIGHT between any two neighbors, and
    // — the whole point of pool-adjacent-violators over a one-directional
    // sweep — centered on the cluster's own mean (50) rather than cascading
    // away from whichever item was processed first.
    const callouts = Array.from({ length: 5 }, (_, i) => callout(`c${i}`, 50));
    const resolved = resolveCallouts(callouts, { top: -1000, bottom: 1000 });

    for (let i = 1; i < resolved.length; i++) {
      expect(resolved[i].y - resolved[i - 1].y).toBeCloseTo(LABEL_LINE_HEIGHT, 5);
    }
    expect(resolved.map((c) => c.y)).toEqual([18, 34, 50, 66, 82]);
    const mean = resolved.reduce((sum, c) => sum + c.y, 0) / resolved.length;
    expect(mean).toBeCloseTo(50, 5);
  });

  it('resolves a mixed cluster (dense group + isolated outlier), centering the group without disturbing the outlier', () => {
    const callouts = [callout('a', 0), callout('b', 5), callout('c', 10), callout('d', 200)];
    const resolved = resolveCallouts(callouts, { top: -1000, bottom: 1000 });
    const byId = Object.fromEntries(resolved.map((c) => [c.id, c.y]));

    // a/b/c's ideal mean is 5 — PAVA centers the trio there instead of
    // cascading down from a's own ideal position.
    expect(byId.a).toBe(-11);
    expect(byId.b).toBe(5);
    expect(byId.c).toBe(21);
    expect(byId.d).toBe(200); // far enough away it's never touched
  });

  it('shifts the whole resolved chain as a block when it would run past the lower bound', () => {
    const callouts = Array.from({ length: 5 }, (_, i) => callout(`c${i}`, 990));
    const resolved = resolveCallouts(callouts, { top: 0, bottom: 1000 });

    expect(resolved[resolved.length - 1].y).toBe(1000);
    for (let i = 1; i < resolved.length; i++) {
      expect(resolved[i].y - resolved[i - 1].y).toBeCloseTo(LABEL_LINE_HEIGHT, 5);
    }
  });

  it('shifts the whole resolved chain as a block when it would run past the upper bound', () => {
    // idealY=5 with top=50: the cascade alone (5,21,37,53,69) never goes
    // below y=5, which is above this plot's top bound, forcing the
    // block-shift branch rather than the lower-bound one above.
    const callouts = Array.from({ length: 5 }, (_, i) => callout(`c${i}`, 5));
    const resolved = resolveCallouts(callouts, { top: 50, bottom: 1000 });

    expect(resolved[0].y).toBe(50);
    for (let i = 1; i < resolved.length; i++) {
      expect(resolved[i].y - resolved[i - 1].y).toBeCloseTo(LABEL_LINE_HEIGHT, 5);
    }
  });
});
