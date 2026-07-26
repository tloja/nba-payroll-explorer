import { MECHANISM_COLORS } from '../../lib/chart/colors';
import type { ContractMechanism } from '../../lib/types';

const PATTERN_SIZE = 7;

function stroke(mechanism: ContractMechanism): string {
  return MECHANISM_COLORS[mechanism].textColor;
}

/**
 * The <pattern> defs referenced by `mechanismPatternId` (lib/chart/colors.ts).
 * Each pattern reuses its own mechanism's already-WCAG-validated `textColor`
 * as the pattern stroke, so the overlay stays legible against its own fill
 * without a second contrast check. Geometry (not just density) differs
 * between tiers — diagonal, reverse-diagonal, horizontal, dots, cross-hatch —
 * so the encoding survives both colorblindness and grayscale printing.
 *
 * Renders once per chart <svg> (inside its own <defs>); referenced from
 * anywhere in the same document via `url(#id)`, including the Legend's
 * swatches, which live outside this <svg> but in the same page.
 */
export function MechanismPatternDefs() {
  return (
    <defs>
      <pattern
        id="mechanism-pattern-rookie_scale"
        width={PATTERN_SIZE}
        height={PATTERN_SIZE}
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <line x1={0} y1={0} x2={0} y2={PATTERN_SIZE} stroke={stroke('rookie_scale')} strokeOpacity={0.32} strokeWidth={1.5} />
      </pattern>
      <pattern
        id="mechanism-pattern-mle"
        width={PATTERN_SIZE}
        height={PATTERN_SIZE}
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(-45)"
      >
        <line x1={0} y1={0} x2={0} y2={PATTERN_SIZE} stroke={stroke('mle')} strokeOpacity={0.32} strokeWidth={1.5} />
      </pattern>
      <pattern id="mechanism-pattern-max" width={PATTERN_SIZE} height={PATTERN_SIZE} patternUnits="userSpaceOnUse">
        <line x1={0} y1={PATTERN_SIZE / 2} x2={PATTERN_SIZE} y2={PATTERN_SIZE / 2} stroke={stroke('max')} strokeOpacity={0.32} strokeWidth={1.5} />
      </pattern>
      <pattern id="mechanism-pattern-dead_money" width={PATTERN_SIZE} height={PATTERN_SIZE} patternUnits="userSpaceOnUse">
        <circle cx={PATTERN_SIZE / 2} cy={PATTERN_SIZE / 2} r={1.1} fill={stroke('dead_money')} fillOpacity={0.38} />
      </pattern>
      <pattern id="mechanism-pattern-hold" width={PATTERN_SIZE} height={PATTERN_SIZE} patternUnits="userSpaceOnUse">
        <line x1={0} y1={0} x2={PATTERN_SIZE} y2={PATTERN_SIZE} stroke={stroke('hold')} strokeOpacity={0.32} strokeWidth={1} />
        <line x1={PATTERN_SIZE} y1={0} x2={0} y2={PATTERN_SIZE} stroke={stroke('hold')} strokeOpacity={0.32} strokeWidth={1} />
      </pattern>
    </defs>
  );
}
