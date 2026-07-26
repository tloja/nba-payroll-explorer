// Axis/labels abbreviated ($55.8M); tooltips exact ($55,761,216) — spec §5.
export function formatAbbreviated(dollars: number): string {
  const millions = dollars / 1_000_000;
  const rounded = Math.round(millions * 10) / 10;
  return `$${rounded.toFixed(rounded % 1 === 0 ? 0 : 1)}M`;
}

export function formatExact(dollars: number): string {
  return `$${dollars.toLocaleString('en-US')}`;
}

// Dollar-mode toggle (spec §6): % of that season's cap, same "abbreviated on
// axis" convention as formatAbbreviated. Values are already percent points
// (e.g. 132.4), not a 0-1 ratio — see lib/chart/toggles.ts.
export function formatPercent(percent: number): string {
  const rounded = Math.round(percent * 10) / 10;
  return `${rounded.toFixed(rounded % 1 === 0 ? 0 : 1)}%`;
}

// Per-figure provenance (spec §8): a fixed, locale-independent "when was this
// retrieved" string for a CapCharge's `retrievedAt` ISO timestamp. Manual
// UTC formatting rather than toLocaleString — deterministic across build/
// render environments and unambiguous about timezone, which matters more
// here than a locale-native date format.
export function formatRetrievedAt(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}
