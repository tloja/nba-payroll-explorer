// One-time static reference table of each NBA team's official primary and
// secondary brand color, keyed by the same team slug used everywhere else in
// this repo (scripts/ingest/basketball-reference/teams.ts' BR slugs, which
// match every real data/teams/<slug>.json's own `teamId`).
//
// Sourced once, by hand, from nbacolors.com's own data feed
// (https://nbacolors.com/js/data.json — the JSON their team pages render
// client-side from) on 2026-07-28, for this M10 session. Primary/secondary
// are that source's own first two listed colors per team, not editorialized
// here. Colors aren't trademarked/copyrighted the way logos are (spec §7),
// so unlike scripts/ingest/, this needed no DATA-SOURCING.md clearance — this
// file is never fetched again at build or runtime, per the M10 instructions.
//
// Known, expected quirk: several teams' official primary hexes are byte-for-
// byte identical (e.g. Chicago/Houston/Toronto all `#CE1141`, Atlanta/
// Portland both `#E03A3E`). That's real NBA branding, not a bug in this
// table — not fabricating distinct shades to disambiguate them.
export type TeamColorPair = { primary: string; secondary: string };

export const TEAM_COLORS: Record<string, TeamColorPair> = {
  ATL: { primary: '#E03A3E', secondary: '#C1D32F' },
  BOS: { primary: '#007A33', secondary: '#BA9653' },
  BRK: { primary: '#000000', secondary: '#FFFFFF' },
  CHO: { primary: '#1D1160', secondary: '#00788C' },
  CHI: { primary: '#CE1141', secondary: '#000000' },
  CLE: { primary: '#860038', secondary: '#041E42' },
  DAL: { primary: '#00538C', secondary: '#002B5E' },
  DEN: { primary: '#0E2240', secondary: '#FEC524' },
  DET: { primary: '#C8102E', secondary: '#1D42BA' },
  GSW: { primary: '#1D428A', secondary: '#FFC72C' },
  HOU: { primary: '#CE1141', secondary: '#000000' },
  IND: { primary: '#002D62', secondary: '#FDBB30' },
  LAC: { primary: '#C8102E', secondary: '#1D428A' },
  LAL: { primary: '#552583', secondary: '#F9A01B' },
  MEM: { primary: '#5D76A9', secondary: '#12173F' },
  MIA: { primary: '#98002E', secondary: '#F9A01B' },
  MIL: { primary: '#00471B', secondary: '#EEE1C6' },
  MIN: { primary: '#0C2340', secondary: '#236192' },
  NOP: { primary: '#0C2340', secondary: '#C8102E' },
  NYK: { primary: '#006BB6', secondary: '#F58426' },
  OKC: { primary: '#007AC1', secondary: '#EF3B24' },
  ORL: { primary: '#0077C0', secondary: '#C4CED4' },
  PHI: { primary: '#006BB6', secondary: '#ED174C' },
  PHO: { primary: '#1D1160', secondary: '#E56020' },
  POR: { primary: '#E03A3E', secondary: '#000000' },
  SAC: { primary: '#5A2D81', secondary: '#63727A' },
  SAS: { primary: '#C4CED4', secondary: '#000000' },
  TOR: { primary: '#CE1141', secondary: '#000000' },
  UTA: { primary: '#002B5C', secondary: '#00471B' },
  WAS: { primary: '#002B5C', secondary: '#E31837' },
};

// The league view's own page background (app/layout.tsx: `bg-[#f9f9f7]`).
// Not imported from there since that's a Tailwind class string, not a value —
// duplicated here as the one other place this exact hex needs to be a real
// constant, same as LeagueOverview.tsx already does for its own ink colors.
const PAGE_BACKGROUND = '#f9f9f7';
const INK_BLACK = '#0b0b0b';
const INK_WHITE = '#ffffff';

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

// WCAG 2.1 contrast ratio between two colors, order-independent.
export function contrastRatio(hexA: string, hexB: string): number {
  const lumA = relativeLuminance(hexA);
  const lumB = relativeLuminance(hexB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

// A fill needs at least this much contrast against the page background to
// read as a distinct, deliberately-colored bar rather than blending into the
// canvas. 3:1 is WCAG 1.4.11's non-text-contrast threshold for a meaningful
// graphical object against its adjacent color.
const MIN_FILL_VS_BACKGROUND_CONTRAST = 3.0;

// Per M10 instructions: prefer each team's primary color for its league-view
// bar fill; if that primary is too light or dark to stay legible, fall back
// to secondary rather than break contrast compliance. Also resolves the
// label ink (pure black or white, whichever wins) that would keep any future
// bar-internal text at >=4.5:1 against the resolved fill — every real NBA
// team color clears this via one of black/white, so this never needs a
// second-level fallback in practice (verified for all 30 teams; only San
// Antonio's silver primary fails the vs-background check and falls back to
// its secondary, black).
export function resolveTeamBarColor(teamId: string): { fill: string; labelInk: string } {
  const pair = TEAM_COLORS[teamId];
  if (!pair) {
    throw new Error(`No team colors configured for teamId "${teamId}"`);
  }

  const fill =
    contrastRatio(pair.primary, PAGE_BACKGROUND) >= MIN_FILL_VS_BACKGROUND_CONTRAST
      ? pair.primary
      : pair.secondary;

  const contrastWithBlack = contrastRatio(fill, INK_BLACK);
  const contrastWithWhite = contrastRatio(fill, INK_WHITE);
  const labelInk = contrastWithBlack >= contrastWithWhite ? INK_BLACK : INK_WHITE;

  return { fill, labelInk };
}
