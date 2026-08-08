# NBA Payroll Explorer — Build Spec

A spec written to be handed to Claude Code. Drop it in the repo root, then work through the milestones in order.

**This is scoped for a public deployment.** That changes three things materially: data sourcing has to be legally defensible rather than merely convenient (§3, §7), the site needs the credibility surface that public sports-data sites are judged on — methodology, timestamps, corrections (§8), and accessibility and social sharing stop being polish and become launch requirements (§9, §10).

---

## 1. What this is

A site that shows, for any NBA team, a stacked bar of every cap charge on the books for a given season, with the salary cap, tax line, first apron, and second apron drawn as horizontal thresholds across the chart. One bar per season, several seasons side by side, so you can see the shape of a team's commitments over time.

The reference graphic is a single-team, two-season version of this. The goal is to generalize it to all 30 teams and 5+ seasons, and to fix two things the reference does poorly:

- **15 arbitrary categorical hues.** Nobody can hold 15 hues in working memory, and the palette encodes nothing. Replace with a meaningful encoding (see §5).
- **Independent per-season sort order.** When each bar is sorted by that season's salary, players jump vertically between bars and the eye can't track anyone. Pick one order and hold it across all seasons.

---

## 2. The hard part is the data model, not the chart

The chart is a weekend. The data model is where this lives or dies. A team's payroll is **not** a list of `{player, salary}`. Build for this from day one:

### Cap charges include non-players

| Charge type | Counts against cap? | Notes |
|---|---|---|
| Standard contract | Yes | The obvious case |
| Two-way contract | **No** | Excluded from team salary entirely |
| Dead money | Yes | Waived/stretched players. Can be huge and is invisible on most sites |
| Free agent cap hold | Yes, until renounced or re-signed | Only relevant when a team is under the cap |
| Unsigned first-round pick hold | Yes | 120% of rookie scale |
| Incomplete roster charge | Yes | Rookie minimum per empty slot below 12 |

A team page that omits dead money and holds will not reconcile against any public payroll total. Model these as first-class stack segments with a `chargeType` discriminator.

### Three different payroll totals

These are not the same number and the distinction is the whole point of the apron lines:

- **Cap payroll** — used for cap space
- **Tax payroll** — used for luxury tax bills
- **Apron payroll** — includes *likely and unlikely* incentives, plus other adjustments; this is what's measured against the apron thresholds

If you draw apron lines against cap payroll, the chart is wrong in a way that looks right. Store `capHit`, `taxHit`, and `apronHit` per charge, even if v1 sets all three equal for most rows.

### Contract metadata worth carrying

`guaranteeStatus` (full / partial / none), `optionType` (player / team / ETO / none), `exceptionUsed` (rookie scale / max / supermax / non-taxpayer MLE / taxpayer MLE / room MLE / BAE / minimum / Bird), `signedDate`, `tradeRestrictionUntil`. These drive the good version of the color encoding and unlock the "how much of this is actually committed" view, which is the most interesting question the data can answer.

### Suggested schema

```ts
type Season = `${number}-${number}`; // "2026-27"

type CapCharge = {
  id: string;
  teamId: string;
  season: Season;
  chargeType: 'player' | 'dead_money' | 'cap_hold' | 'draft_hold' | 'incomplete_roster';
  label: string;              // "Shai Gilgeous-Alexander", "Dead money: J. Doe"
  playerId?: string;
  capHit: number;
  taxHit: number;
  apronHit: number;
  guaranteeStatus: 'full' | 'partial' | 'none';
  guaranteedAmount?: number;
  optionType: 'player' | 'team' | 'eto' | null;
  exceptionUsed?: string;
};

type SeasonThresholds = {
  season: Season;
  isProjected: boolean;
  salaryCap: number;
  minimumTeamSalary: number;
  taxLevel: number;
  firstApron: number;
  secondApron: number;
};
```

### Known thresholds (hardcode these, they're announced annually)

```
2025-26:  cap 154,647,000 | tax 187,895,000 | apron1 195,945,000 | apron2 207,824,000
2026-27:  cap 164,961,000 | tax 200,428,000 | apron1 209,015,000 | apron2 221,686,000
          minimum team salary 148,465,000
```

Future seasons are projections — flag them `isProjected: true` and render their threshold lines dashed. Never present a projected apron line as fact.

---

## 3. Where the data comes from — resolve this before writing ingestion code

There is no free, official, public NBA salary API. This is the single hardest constraint on the project and it is a business decision, not an engineering one. Resolve it in M0.

### The problem with scraping, stated plainly

Scraping a competitor's site and republishing the result as your own public product is the failure mode here. Individual salary figures are facts, and in the US facts aren't copyrightable (*Feist v. Rural Telephone*) — but that is a narrower shield than people assume:

- **Terms of service create contract liability independent of copyright.** A site can lose a copyright argument and still win a breach-of-contract or unjust-enrichment claim. Spotrac's ToS prohibits scraping and they sell a commercial data API — republishing their compilation publicly is the clearest way to get a cease-and-desist.
- **Compilations get thin copyright** in the selection, arrangement, and editorial judgment. Dead money calculations, cap hold estimates, and apron adjustments are *derived* values reflecting someone's methodology — closer to protected work product than raw facts.
- **The EU has sui generis database rights**, which protect substantial investment in compiling a database with no US-style facts exemption. If you serve EU traffic, this matters.

None of this is legal advice and I'm not a lawyer — but it's the shape of the risk, and it's worth an hour with one before launch if this becomes anything more than a hobby.

### Viable paths, ranked for a public site

1. **License a commercial feed.** Spotrac has a developer/API offering. This is the fastest legitimate route to complete data and the only one that fully de-risks launch. Get a quote in M0 — if the price is workable, everything downstream gets easier.
2. **Build your own dataset from primary sources.** NBA press releases set the annual cap/tax/apron numbers. The CBA defines rookie scale, minimum scale, and MLE amounts as published tables. Transactions are publicly reported. Compiling contracts from these is a real editorial effort — it is what Spotrac and Basketball-Reference themselves did — but the resulting database is *yours*, defensible, and becomes the actual moat. Realistically a multi-month grind, or a community contribution model.
3. **Hybrid: derive, don't copy.** Store only the contract primitives you can source or verify — start salary, years, annual raise %, guarantee structure, option type — and *compute* every displayed figure (cap hit per season, dead money, holds, apron payroll) from CBA rules in your own engine. This meaningfully changes the character of the work from republication to independent derivation, and the calculation engine is genuinely valuable on its own. It also means your numbers will occasionally disagree with other sites, which you handle with a methodology page rather than by fudging toward consensus.
4. **Ask permission.** Underrated. A short email explaining a non-commercial visualization project with prominent attribution and links back gets a yes more often than people expect. Get it in writing.

**Recommendation: (3) as the architecture, (1) if the licensing quote is affordable, (2) filling gaps.** Building the rules engine is the right call regardless, because it's what lets you show projections, model hypothetical trades, and explain your numbers — none of which a scraped total can do.

### Architecture

`scripts/ingest/` holds source-specific adapters that all emit the same `CapCharge[]`; `lib/cba/` holds the rules engine that derives cap hits from contract primitives. Output is versioned JSON in `data/`, regenerated by a scheduled GitHub Action that commits the diff. The site reads static JSON at build time.

Every record carries `sourceId`, `sourceUrl`, `retrievedAt`, and `derivation` (`sourced` | `computed` | `estimated`). This is not bookkeeping overhead — it's what powers the methodology page, the per-figure provenance tooltips, and your ability to answer "where did this number come from" when someone challenges it publicly. They will.

Do **not** build a live-scraping API route. Slow, rate-limited, and it turns every visitor into a request against someone else's server under your name.

`scripts/verify.ts` asserts each team's summed segments reconcile to the expected total, ±$1, and fails CI on drift. Scrapers and rules engines both rot silently.

### Robots and rate limits, if you scrape anything at all

Honor `robots.txt`. Set a descriptive `User-Agent` with a contact URL. Cache aggressively and re-fetch on the order of days. Basketball-Reference enforces roughly 20 requests/minute and will IP-ban above it. Never run ingestion from user request paths.

---

## 4. Stack

- **Next.js (App Router) + TypeScript**, statically exported
- **D3 for math, React for DOM.** Use `d3-scale`, `d3-shape`, `d3-array` to compute geometry; render the `<svg>` yourself in JSX. Never hand D3 the DOM inside React.
- **Do not use Recharts / Chart.js / Nivo.** They cannot do the leader-line label callouts that make this chart readable, and fighting them costs more than writing ~300 lines of SVG.
- **Tailwind** for layout chrome only. The chart is hand-authored SVG.
- **Vitest** for the layout algorithms — label collision resolution is exactly the kind of pure function that should have tests. Also unit-test the CBA rules engine hard: dead money schedules, option years, and apron math are where wrong-but-plausible numbers hide.
- **Playwright** for one smoke test per route plus a visual regression snapshot of the chart. A silently broken chart on a public site is worse than a down site.

### Public deployment
- **Static export behind a CDN** (Vercel, Netlify, or Cloudflare Pages). Non-negotiable: a well-shared payroll graphic can spike to six figures of traffic in an afternoon, and on a statically exported site that costs approximately nothing. On a dynamic site it costs money and may fall over.
- **Analytics:** Plausible or Umami, not Google Analytics. No cookies means no consent banner in most jurisdictions, which removes an entire compliance surface.
- **Error monitoring:** Sentry free tier, client-side only.
- **Uptime + build alerts:** ingestion failing silently for two weeks is the realistic failure mode. Alert on a failed Action *and* on data older than 72 hours.
- **Security headers:** CSP, HSTS, `X-Content-Type-Options`. Cheap to set once at the CDN edge.

---

## 5. The chart

### Geometry
- Band scale on x (one band per season), linear scale on y (dollars), `nice()`-ed to a round ceiling above the second apron.
- Threshold lines span the full plot width with right-edge labels. Style them distinctly from gridlines — they're the reference frame, not decoration.
- Stack order: sort by the **selected focus season's** `capHit` descending, then apply that same order to every season's bar. Players leaving the roster simply have no segment in later seasons. This makes horizontal tracking possible, which is the entire value of showing multiple seasons.

### Labels — the actual hard problem
1. If a segment's height ≥ label line-height + 4px padding, place the label centered inside it.
2. Otherwise it becomes an **outside callout**: label placed to the right of the bar with a two-segment leader line (horizontal stub from the segment's vertical midpoint, then elbow to the label).
3. Outside callouts collide. Resolve with a 1D packing sweep: sort callouts by ideal y, then iterate — push each down until it clears the previous one's bottom, then run the pass in reverse pushing up, until stable or 50 iterations. `d3-force` with `forceY` + `forceCollide` on a single axis also works and is fewer lines.
4. If more than ~8 segments need callouts, collapse the smallest into a single "Others (n)" segment that expands on click. The reference graphic is right at the edge of legibility; teams with more minimum contracts will blow past it.

### Color — replace the 15-hue palette
Two encodings that carry information, either better than arbitrary hues:

- **By contract mechanism** — max/supermax, rookie scale, MLE, minimum, dead money, hold. Six categories, teaches the reader something, works for colorblind users.
- **By guarantee status** — solid = fully guaranteed, hatched = non-guaranteed, outlined = option year. Immediately answers "how much of this is real?"

Use the team's primary color as a single-hue lightness ramp for player segments (ordered by salary), reserving one distinct off-hue for dead money and holds. Every team page then feels like that team without inventing 15 hues.

### Signature idea worth building
Shade the portion of the bar **above each threshold** differently — a tint or hatch that starts at the tax line, intensifies above apron 1, intensifies again above apron 2. The reader instantly sees not just *that* a team is over the second apron but *how far in*, which is the number that actually governs their offseason. This is the one place to spend visual boldness; keep everything else quiet.

### Number formatting
Axis and labels abbreviated (`$55.8M`), tooltips exact (`$55,761,216`). Use tabular/monospace numerals throughout — a cap sheet full of proportional digits looks amateur.

---

## 6. Routes

| Route | Content |
|---|---|
| `/` | All 30 teams, sorted by payroll, as thin horizontal bars against shared threshold lines. The league-wide "who's in the aprons" view. |
| `/team/[slug]` | The main chart. Season range selector, focus-season selector, toggles. |
| `/team/[slug]/[season]` | Deep link to a single season, shareable. |
| `/compare?teams=okc,bos,nyk` | Same y-scale, bars side by side. |
| `/player/[slug]` | Optional. Cap hit across seasons, guarantee structure. |
| `/methodology` | How every number is derived. Non-optional for a public site — see §8. |
| `/sources` | Data provenance and attribution, per source. |
| `/glossary` | Apron, hard cap, stretch provision, cap hold, Bird rights. Doubles as SEO surface. |
| `/corrections` | Submitted corrections and what was changed. Builds trust faster than anything else. |
| `/about` | What this is, who made it, affiliation disclaimer. |
| `/privacy` | Required if you collect anything at all, including analytics. |

### Toggles on the team page
- Cap payroll / tax payroll / apron payroll
- Include or exclude dead money and holds
- Absolute dollars / % of that season's cap (makes cross-season comparison honest, since the cap moves ~7%/yr)
- Guaranteed only / all committed

---

## 7. Trademark, branding, and disclaimers

Team names and logos are NBA trademarks. The rules are workable but specific:

- **Team names in text are fine.** Using "Oklahoma City Thunder" to refer to the Thunder is nominative use — you need the name to identify the thing you're describing. Editorial and informational use is well-established here.
- **Do not use team or league logos.** Not in the UI, not as favicons, not in social cards. Build simple text wordmarks or your own geometric team marks instead. This is the most common thing hobby sports sites get a letter about.
- **Team colors are not individually protectable**, so the single-hue ramp from §5 is safe. Reproducing a team's full brand system — logo, wordmark, typeface, colors together — is not.
- **No player headshots.** Player likenesses are licensed through the NBPA. Names and factual salary data are fine; photos are not. Use initials, silhouettes, or nothing.
- **No league-adjacent naming.** Avoid domains and product names containing "NBA" or a team name (`nbapayroll.com` invites a problem; `capsheet.io` does not).
- **Disclaimer in the footer of every page:** not affiliated with, endorsed by, or sponsored by the NBA, the NBPA, or any team. One sentence, always visible.

Also needed before launch: a Terms of Use, a privacy policy matching what you actually collect, and a designated DMCA contact if you ever accept user submissions.

---

## 8. Credibility surface

Public sports-data sites live or die on whether people trust the numbers. Fans will check your figures against three other sites and tell you loudly when you differ. Build for that:

- **"Last updated" timestamp on every team page**, sourced from the data file, not the build time. Stale data presented as current is the fastest way to lose an audience.
- **A real methodology page.** What counts in cap vs. tax vs. apron payroll. How dead money is calculated. How you handle unsigned picks, holds, and incentives. Which figures are computed vs. sourced. Write it in plain language — it doubles as the best content on the site.
- **Per-figure provenance.** Tooltip or expandable showing `derivation` and `retrievedAt` for any number a reader questions. This single feature converts arguments into non-events.
- **Visible uncertainty.** Projected thresholds dashed. Estimated values marked. Option years visually distinct. Never render a guess with the same confidence as a fact.
- **A corrections path.** A form or an email address, plus a public log of what was fixed and when. Cheap to build, disproportionate to trust.
- **Say which source you follow when sources disagree**, in the footer. Outlets genuinely differ on holds and incentives; owning your choice reads as competence, quietly matching consensus reads as guessing.

---

## 9. Accessibility — a launch requirement

For a public site in the US, web accessibility carries real ADA exposure, and separately, a data visualization nobody can read with a screen reader is just a worse product. Target **WCAG 2.1 AA**.

- **The chart needs a non-visual equivalent.** Render an offscreen `<table>` of the same data, or offer a visible table toggle. This is the single most important item and the one most chart implementations skip.
- **Never encode meaning by color alone.** The §5 encodings pair hue with pattern and direct labels, which already satisfies this — keep it that way.
- **4.5:1 contrast** for text, including labels sitting inside colored bar segments. Test the light end of the single-hue ramp specifically; that's where it breaks.
- **Keyboard navigation through segments** with a visible focus ring, and `aria-label` on each giving name and dollar amount.
- **Respect `prefers-reduced-motion`** on any transitions.
- **Semantic headings, skip link, real `<title>` per route.**

Run axe-core in CI so regressions fail the build.

---

## 10. SEO and social sharing

A payroll chart is *made* to be shared into an argument on social media. This is your entire distribution channel — treat it as a feature, not an afterthought.

- **Dynamic OG images per team and season.** Server-render the chart as a 1200×630 PNG at build time so a shared link previews as the actual graphic, not a generic card. This is the highest-leverage feature on this list by a wide margin.
- **Deep-linkable state.** Every toggle, selected season, and comparison set encoded in the URL, so a shared link reproduces exactly what the sharer was looking at.
- **A visible "copy image" / "download PNG" button** on the chart. People will screenshot it regardless; giving them a clean export with your URL watermarked in the corner turns every screenshot into attribution.
- **Per-route metadata and structured data.** Unique title and description per team page. `SportsTeam` schema.org markup.
- **`sitemap.xml` and `robots.txt`**, generated at build.
- **Canonical URLs**, since `/team/okc` and `/team/okc/2026-27` will otherwise compete.
- **Performance budget:** LCP under 2.5s on mobile. Most of your traffic will arrive from a phone via a shared link, on a bad connection, with no patience. The chart must render at 390px width without a horizontal scroll.

---

## 11. Milestones for Claude Code

Work these as separate sessions. Don't let it attempt more than one at a time.

**M0 — Resolve data rights.** Not a coding task, and it gates everything after M3. Get a licensing quote. Read the ToS of any source you're considering. Decide between license / own-compilation / derive-from-primitives (§3). Write the decision and its reasoning into `DATA-SOURCING.md` in the repo so the constraint stays visible to every later session. Do this first — discovering in M6 that your data can't be published publicly means throwing away the ingestion layer.

**M1 — Chart against a synthetic fixture.** M1's job is proving the chart component is correct — layout, label packing, threshold lines, responsive behavior — *not* displaying real data. Do not attempt to source, scrape, or reconstruct real player salaries in this milestone; real data is M3's job and is deliberately out of scope here. There is no reference graphic available to this session and none is needed.

Hand-write `data/fixtures/synthetic.json`: roughly 12–14 fabricated players across two seasons (use the real threshold values from §2 for 2025-26 and 2026-27 so the lines land correctly, but invent the player names and dollar figures). Shape the numbers like a real cap sheet — a couple of max-tier deals, several mid-size, several minimums — and include at least one `dead_money` entry and one `cap_hold` so those code paths get exercised. Span segments both above and below the apron lines so the over-threshold shading (§6) is visible. Mark every record `derivation: 'synthetic'` and `sourceId: 'placeholder'`; this is honest provenance, not a stopgap to fix later.

Build the full chart component against it: scales, stacking, threshold lines, inside labels, outside callouts with collision resolution, the color-by-contract-mechanism encoding, and the over-threshold shading. No scraping, no routing. Ship when it renders correctly at 1440px, 768px, and 390px.

**M2 — Types, thresholds, and validation.** Lock the schema in §2. Add the threshold table. Write `verify.ts`. Add Vitest coverage for the label-packing function specifically.

**M3 — CBA rules engine + one ingestion adapter.** Build `lib/cba/` to derive cap hits, dead money schedules, and apron payroll from contract primitives. Then one adapter, consistent with the M0 decision, emitting `CapCharge[]` with full provenance fields. Get all 30 teams into `data/`. Run `verify.ts` and fix the reconciliation gaps — this is where dead money and holds will bite.

**M4 — Routing and the league view.** Team pages, season deep links, the `/` overview, URL-encoded chart state.

**M5 — Interactions.** Hover-highlight a player across all seasons, click to pin, the toggle set, keyboard navigation through segments.

**M6 — Accessibility pass.** Data table equivalent, contrast audit, keyboard nav, axe-core in CI. Do this before launch, not after — retrofitting a11y into a chart is significantly harder than building it in.

**M7 — Public surface.** Methodology, sources, glossary, about, privacy, corrections. Footer disclaimer. Provenance tooltips. "Last updated" timestamps.

**M8 — Sharing.** Build-time OG image generation per team/season, download-PNG button, structured data, sitemap, canonical URLs.

**M9 — Automation and launch.** Scheduled ingest Action with failure alerting and a staleness alarm. Static export deploy behind a CDN. Sentry, Plausible, security headers. Load-test the CDN config against a simulated spike before you share the link anywhere.

**M10 — League-view team color coding.** The home page's thin per-team bars (built in M4) currently use a single default color for all 30 teams. Replace this with each team's real primary color, per §5's principle of using color to carry information rather than picking arbitrary hues.

Source each team's primary and secondary hex colors from nbacolors.com into a static config file (e.g. `lib/team-colors.ts`) — colors alone aren't trademarked the way logos are (§7), so this needs no DATA-SOURCING.md-style gating. Use each team's primary color for that team's bar fill on the `/` league view; fall back to their secondary color or adjust label text color per team if primary color breaks 4.5:1 contrast on inside labels. Keep the shared y-scale and threshold lines from M1 unchanged — this is a fill-color change only, and must not touch the team-page chart's separate color-by-contract-mechanism encoding from §5. Rerun axe-core after applying colors; 30 new background colors is exactly the kind of change likely to introduce a contrast regression on some subset of teams.

**M11 — 2027-28 projected season.** Extend the team-page chart from two bars (2025-26, 2026-27) to three, adding 2027-28. This season is materially different from the first two: it's far enough out that cap/tax/apron thresholds are projections rather than announced figures, and a meaningful share of the roster won't have a known 2027-28 cap hit yet (unexercised options, unsigned draft picks, expiring contracts with no successor). Treat that uncertainty as a first-class part of this milestone, not an edge case to patch around later.

Before doing anything else in this milestone: check whether the M3 ingestion adapter actually populated `optionType` and `guaranteeStatus`/`guaranteedAmount` with real values across the 30 teams, or left them as stubs/defaults (null, always `'full'`, etc.). §2's schema always had these fields, but whether M3 actually filled them in is unverified as of this milestone being written. If they're stubbed, populating them for real is a prerequisite task within this milestone, not something to work around.

Compute 2027-28 threshold projections using the ~10% cap growth assumption (or whatever growth rate is already documented in `lib/cba/` — check before inventing a new one) applied to 2026-27's known figures, marked `isProjected: true` and rendered dashed. Include only guaranteed 2027-28 salary already on the books — never project likely re-signings or assume an option will be exercised. Mark every 2027-28 record's `derivation` honestly (`'sourced'` only for genuinely known guaranteed years, `'computed'` for CBA-engine-derived figures, never `'sourced'` for anything requiring a future decision). Render unresolved option years as a visually distinct segment style (hatched/outlined per the guarantee-status encoding in §5), not as normal segments and not omitted. Extend the shared y-scale and fixed stack order to three seasons, confirm the season selector/hover-highlight/URL state from M5 handle three seasons correctly, recheck responsive layout at 1440/768/390px with a real plan for three bars on narrow screens, and update `/methodology` to explain the projection method and why 2027-28 looks sparser than the other two seasons. Do not backfill 2028-29. Do not fabricate any contract detail to make a bar look more complete — a sparse, honest 2027-28 bar is correct.

---

## 8. CLAUDE.md for the repo

```md
# NBA Payroll Explorer

This site is PUBLIC. Data sourcing is constrained by DATA-SOURCING.md — read it
before touching anything in scripts/ingest/.

## Rules
- D3 computes geometry; React renders the DOM. Never call .append() on a node React owns.
- No charting libraries. The chart is hand-authored SVG.
- All money is integer cents-free dollars. Never floats. Never strings.
- Every cap charge carries capHit, taxHit, and apronHit. Apron thresholds are compared
  against apronHit only.
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
```

---

## 9. Things that will surprise you

- **Traded players** appear on two teams in one season with split cap hits. Your `teamId` cannot be on the player; it must be on the charge.
- **Stretch provision** dead money runs 2× remaining years + 1, so a 2024 waiver can still be on the 2029 books.
- **Poison pill / offer sheet** cap hits differ between the two teams involved.
- **Rookie scale options** are exercised in October for the *following* season, so future-year data is genuinely uncertain, not just unscraped. Mark it.
- Team payroll totals published by different outlets **disagree**, usually over holds and incentives. Pick one source of truth per view and say which one in the footer.

### And once it's public

- **Traffic is spiky and event-driven,** not steady. A trade deadline, a max extension, or one popular account sharing a chart produces the entire month's traffic in six hours. Static-behind-a-CDN is what makes that a non-event.
- **Your first real users are the most demanding ones.** NBA cap nerds are unusually rigorous and will find your errors within a day. This is a gift if you have a corrections path and an embarrassment if you don't.
- **Ingestion will break on schedule.** Sites redesign, teams get new slugs, a new CBA provision appears. Assume a fix every couple of months and alert on staleness rather than waiting for someone to tweet that your data is three weeks old.
- **Every offseason breaks assumptions.** Draft picks with holds but no contract, two-way conversions mid-season, in-season signings that shift roster charges. Build the ingest to tolerate partial data rather than throwing.
- **The next CBA will change the rules.** Aprons, the stretch provision, and exception amounts are all CBA-defined. Keep rule constants in dated, versioned config rather than inline in the engine, so a rule change is a data edit rather than a refactor.
