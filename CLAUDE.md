# NBA Payroll Explorer

This site is PUBLIC. Data sourcing is constrained by DATA-SOURCING.md — read it
before touching anything in scripts/ingest/.

Read nba-payroll-site-spec.md for full context. Work one milestone per session.

## Rules
- D3 computes geometry; React renders the DOM. Never call .append() on a node React owns.
- No charting libraries. The chart is hand-authored SVG.
- All money is integer cents-free dollars. Never floats. Never strings.
- Every cap charge carries capHit, taxHit, and apronHit. All four threshold lines (cap,
  tax, first apron, second apron) are compared against whichever of capHit/taxHit/apronHit
  the chart's Basis toggle currently selects — coupled across the whole chart, not
  apronHit unconditionally (see /methodology item 1). This was a deliberate M5 choice;
  update this line again if the toggle behavior ever changes.
- Every cap charge carries sourceId, sourceUrl, retrievedAt, and derivation
  ('sourced' | 'computed' | 'estimated'). No exceptions — provenance is a public feature.
- Two-way contracts do not count against team salary. Exclude them from stacks.
- Projected thresholds render dashed and labeled "projected". Estimated values are
  visually distinct from sourced ones. Never render a guess at full confidence.
- Scraper adapters emit CapCharge[] and nothing else. Source-specific parsing never
  leaks past the adapter boundary.
- Chart state lives in the URL so every view is shareable.
- Milestones own their data. Before M3, no real player salary data exists in this repo
  and none is expected — use synthetic fixtures (derivation: 'synthetic', sourceId:
  'placeholder'). Never block an early milestone waiting for real data a later
  milestone provides, and never reconstruct real contract figures from model knowledge
  to fill the gap. If a milestone seems to need real data it doesn't have, the answer
  is a synthetic fixture, not sourcing.
- WCAG 2.1 AA is a build requirement. Every chart ships with a table equivalent.
- scripts/verify.ts and axe-core must pass before any commit.

## Commands
pnpm dev / pnpm test / pnpm e2e / pnpm ingest / pnpm verify / pnpm a11y

## Don't
- Don't add a live-scraping API route.
- Don't reconstruct real player salaries from your own knowledge to unblock a milestone.
  Synthetic fixtures before M3; real data only via a cleared adapter in M3+.
- Don't add a data source that isn't already cleared in DATA-SOURCING.md. Ask first.
- Don't use NBA or team logos, wordmarks, or player photos anywhere, including
  favicons and OG images.
- Don't re-sort stack order per season.
- Don't introduce a new color per player.
- Don't encode meaning by color alone.
- Don't adjust a computed figure to match another site's number. Fix the rules engine
  or document the difference.
