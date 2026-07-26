# Notes

## M1 — Chart against a synthetic fixture (2026-07-25)

Built the chart component per spec §5/§6 against a hand-written synthetic fixture. No
ingestion, no routing beyond `/` as a single test page, no real player data.

### What's here
- `data/fixtures/synthetic.json` — 13 fabricated players + 1 dead-money entry + 2 cap
  holds across 2025-26 and 2026-27 for a fictional team ("Example Team", not a real
  NBA team — chosen instead of a real team name to keep synthetic dollar figures from
  reading as real for any actual franchise). Real threshold values from spec §2. Totals
  land at $208.85M (2025-26, $1.03M over the second apron) and $200.95M (2026-27,
  $522K over the tax line only) so both apron-crossing and tax-only shading render.
  Every record: `derivation: 'synthetic'`, `sourceId: 'placeholder'`.
- `lib/types.ts` — `CapCharge`/`SeasonThresholds` per §2, plus the six-way
  `ContractMechanism` classifier used for color.
- `lib/chart/stack.ts`, `scales.ts`, `labels.ts`, `thresholds.ts` — pure functions, no
  D3-in-React, no DOM. `labels.ts` is the label-collision algorithm from the pre-build
  plan: height+width fit check → outside callout → collapse smallest to "Others (n)"
  above 8 → bidirectional 1D packing sweep (≤50 iterations) → clamp to plot bounds.
  Kept dependency-free so M2's Vitest suite can hit it directly.
- `components/chart/PayrollChart.tsx` — the chart. Two render passes (all bar
  fills/shading/lines, then all labels/callouts) so a callout can never be visually
  covered by a later season's bar.
- Next.js 15 (App Router) + TS + Tailwind skeleton, hand-authored SVG chart.

### Decisions made along the way
- **Node wasn't installed at session start.** `brew install node` ended up compiling
  `cmake` and other deps from source (no bottles for this macOS version) and was still
  running after ~10 minutes, so at the time this session downloaded the official
  prebuilt tarball into `~/.local/node` (v22.13.0) as a workaround. The `brew install`
  was left running in the background and **failed on its own** (exit 1) — harmless,
  nothing depended on it.
- **You've since installed Node yourself via nvm** — verified 2026-07-25: `node -v`
  reports v24.18.0, `npm -v` reports 11.16.0, both at `~/.nvm/versions/node/v24.18.0/`.
  Confirmed working against this project specifically, not just present on the
  machine: `npx tsc --noEmit` and `npm run build` both ran clean under it. This is now
  the Node to use going forward — the earlier `~/.local/node` v22 workaround is no
  longer necessary, though it's still on disk and harmless if left alone.
  Originally, nvm's init in `~/.bashrc` (`export NVM_DIR=...` + sourcing `nvm.sh`)
  wasn't reachable from here: `~/.bashrc` is only auto-sourced by *interactive* bash
  shells, and every command this tool runs is a fresh non-interactive one, so
  `node`/`npm` weren't on `PATH` by default even though they worked fine in a regular
  terminal.
  **Fixed 2026-07-25** by adding `export BASH_ENV="$HOME/.bashrc"` to
  `~/.bash_profile` — `BASH_ENV` is bash's hook specifically for getting
  non-interactive shells to auto-source a file, so this makes `~/.bashrc` (and nvm's
  node) load automatically here too, no more manual `source ~/.bashrc` needed. Also
  fixed a pre-existing typo on `~/.bashrc` line 1 (`PS1 = '\n'` → `PS1='\n'` — the
  spaces made bash treat it as a command instead of an assignment, which is what
  printed the harmless `PS1: command not found` warning). Both verified working:
  sourcing no longer warns, and a bare-minimum simulated shell
  (`env -i BASH_ENV=~/.bashrc HOME=$HOME PATH=/usr/bin:/bin bash -c 'node -v'`, no
  inherited PATH extras at all) still found node purely via `BASH_ENV`.
  Two caveats worth knowing: (1) this is machine-wide, not scoped to this project or
  to Claude Code — any non-interactive `bash -c` on this machine now auto-sources
  `~/.bashrc` too (cron jobs, other tools); low-risk since that file only loads nvm +
  cargo, but worth remembering if something behaves oddly later. (2) It didn't apply
  retroactively to the session it was made in — environment is fixed for the life of
  an already-running process — so still needed `source ~/.bashrc` manually for the
  remainder of that session. Confirmed by simulation, not by this session's own
  commands suddenly working.
  **Next session should confirm this for real**: try a plain `node -v` with no
  `source ~/.bashrc` prefix. If it just works, the fix held — you can drop the
  sourcing habit for good and simplify commands going forward. If `node` still
  isn't found, the simulation above was missing something about how this specific
  tool spawns shells (e.g. it might invoke `bash` with an explicit flag that
  overrides `BASH_ENV`, or scrub the parent environment before launching) — don't
  assume it's fixed, re-diagnose from there rather than reapplying the same patch.
  **Confirmed in the M2 session (2026-07-25): plain `node -v` still fails, root
  cause now diagnosed for real.** `BASH_ENV` is genuinely set in every Bash-tool
  invocation's environment (`echo $BASH_ENV` → `/Users/thomasloja/.bashrc`), and
  bash's startup does source it, running `nvm.sh` and prepending node's bin dir to
  `PATH` — the fix itself works exactly as intended. But each tool call's actual
  script (visible via `ps -p $$ -o args=` from inside a running command) is
  `bash -c 'source <shell-snapshot>.sh && ... && eval "<command>"'` — and that
  shell-snapshot file contains a literal frozen `export PATH='...'` line, captured
  at some earlier point with no `.nvm/versions/node/...` segment in it at all. That
  line runs *after* `BASH_ENV` has already sourced `~/.bashrc`, so it unconditionally
  stomps the PATH nvm had just set up, every single call, for the life of the
  session. This is a harness/tool-wrapper behavior, not fixable from
  `~/.bash_profile` or `~/.bashrc` — manually running `source ~/.bashrc` (which
  re-runs `nvm.sh` *after* the snapshot's clobber) remains genuinely necessary
  before any `node`/`npm` command, for every command, for the rest of any session.
  Stop expecting this to resolve itself; it won't unless the snapshot mechanism
  itself changes.
  **Actually fixed for good, same session, right after diagnosing the above.**
  `~/.local/bin` is already the *first* entry in the frozen snapshot `PATH` (it's
  where the `claude` CLI's own symlink lives), so anything placed there is found
  immediately, before the snapshot's stale `PATH=` line can matter — no `BASH_ENV`
  timing involved at all. Symlinked `~/.local/bin/{node,npm,npx}` →
  `~/.nvm/versions/node/v24.18.0/bin/{node,npm,npx}`. Verified with a completely
  fresh Bash call, no sourcing: plain `node -v`/`npm -v`/`npx -v` all resolve, and
  `npm run verify` / `npm test` both work from a cold shell. **No more
  `source ~/.bashrc` prefix needed, at all, going forward** — drop the habit.
  One caveat: these symlinks point at the specific v24.18.0 install; if you ever
  switch nvm's active/default node version, they won't follow automatically and
  will need to be re-pointed by hand (a `readlink`/re-`ln -s` on those three
  files), since they don't go through nvm's own shim mechanism.
- **Threshold lines are per-season, not full-chart-width.** Spec §5 says lines "span the
  full plot width," but 2025-26 and 2026-27 have different announced cap/tax/apron
  figures — one line spanning both seasons' bars would show the wrong number for
  whichever season it doesn't belong to, which is exactly the "wrong in a way that
  looks right" failure mode spec calls out elsewhere for capHit-vs-apronHit. Each
  season's four threshold lines are confined to that season's band.
- **Threshold labels moved to a small fixed header above each band**, not inline on the
  line. A threshold line frequently falls *inside* a filled segment (that's precisely
  when the over-threshold shading matters), and a label there collided with the
  segment's own text. The header is always exactly 4 fixed rows in a fixed order, so it
  needs no collision resolution.
- **`minimumTeamSalary` for 2025-26** isn't given in spec §2 (only 2026-27's
  $148,465,000 is). Computed it from the documented CBA formula (90% of that season's
  cap) rather than leaving it out or guessing a number — 154,647,000 × 0.9 =
  139,182,300, and that ratio is exactly what the given 2026-27 figure implies
  (148,465,000 / 164,961,000 = 0.9000). Not currently rendered by the M1 chart itself
  (the chart draws cap/tax/apron1/apron2 only, per §5), just carried in the fixture for
  schema completeness.
- **capHit === taxHit === apronHit for every fixture row.** Spec §2 explicitly allows
  v1 to set all three equal. The apron-shading code reads `apronHit`-derived totals
  specifically (not `capHit`), per CLAUDE.md's "apron thresholds compared against
  apronHit only" — satisfied at the code level now, will matter once M3 sources data
  where the three genuinely diverge.
- **Color: six-category contract-mechanism encoding**, not the arbitrary 15-hue
  original. Four active-contract tiers (max, MLE, rookie scale, minimum) as one
  validated ordinal blue ramp; dead money and cap holds as two reserved off-hues,
  since they aren't a "tier" of active contract and can land anywhere in the stack by
  dollar value. Validated with the dataviz skill's `validate_palette.js`: ordinal ramp
  passes all four ordinal checks; the three underlying hues (ramp, dead-money orange,
  hold aqua) pass all-pairs CVD/contrast. One ramp step (blue 450) was skipped because
  it fails 4.5:1 with *either* black or white label text — used step 500 instead, so
  the four ramp steps aren't quite evenly spaced.
- **Inside-vs-outside label classification checks width, not just height.** A segment
  can be tall enough for one line of text and still too narrow for its own label
  (long charge names in a narrow band) — found this from an actual overflow bug
  ("Cap hold: R. Kessler (pending FA)" spilling past its segment) while verifying the
  1440px render, not from the original algorithm plan.
- **Callout gutter width is computed per band, not fixed**, and callout text truncates
  with an ellipsis (full label still on a `<title>` tooltip) once it wouldn't fit
  before the next band or the plot's right edge. Also found via visual verification —
  at 768px a fixed-width assumption let "Dead money: T. Sorrento" run onto the next
  bar's fill.
- **Right margin scales with container width** instead of a fixed 190px. At 390px a
  fixed margin sized for 1440px made the internal layout math assume more width than
  the SVG element actually had, and content silently clipped at the SVG's own edge
  rather than overflowing visibly. Margin now scales between 56px and 190px based on
  container width, and verified `document.documentElement.scrollWidth` stays at the
  viewport width (no horizontal scroll) at 390px.
- **Deferred to M6 per the spec's own milestone split**: the offscreen/toggle data
  table equivalent, full contrast audit, and axe-core wiring. CLAUDE.md's "every chart
  ships with a table equivalent" reads as a launch requirement, and §11 explicitly
  assigns "data table equivalent" and "contrast audit" to M6 — built cheap a11y
  affordances now (`role="graphics-symbol"` + `aria-label` per segment, keyboard
  focus ring, computed 4.5:1-passing label text colors) but didn't build the M6-owned
  table/audit pass.

### Verified
- `npx tsc --noEmit` clean.
- `npm run build` — production build + static export succeeds.
- Palette validated via the dataviz skill's `validate_palette.js` (ordinal ramp: all
  checks pass; off-hues: all-pairs CVD/contrast pass).
- Label collision algorithm sanity-checked standalone against a synthetic cluster of
  10 tightly-packed segments: correctly collapsed to 8 callouts ("Others (3)") with a
  16px minimum gap between every resolved label.
- Rendered and screenshotted at 1440px, 768px, and 390px (Chrome via Playwright,
  installed ad hoc for this verification only — not added to `package.json`). No
  horizontal scroll at 390px. Over-threshold shading, threshold headers, inside
  labels, outside callouts with leader lines, and the "Others (n)" click-to-expand
  interaction all confirmed working at all three widths.

### Known gaps (intentionally out of M1 scope)
- No data table equivalent, no axe-core, no full contrast audit — M6.
- No Vitest suite for the label/stack pure functions yet — M2's job, though the
  functions were written with that in mind (pure, no D3/DOM dependency).
- `capHit`/`taxHit`/`apronHit` are equal in this fixture; divergence and its visual
  handling is untested until real contract data with incentives exists (M3+).

## M2 — Types, thresholds, and validation (2026-07-25)

Locked the §2 schema, added versioned threshold data, wrote `scripts/verify.ts`, and
added Vitest coverage for the label-packing algorithm. No ingestion, no routing, no
real player data — per CLAUDE.md, only the synthetic fixture changed shape.

### What's here
- `lib/types.ts` — unchanged as the schema itself (M1 already built it to match §2
  verbatim, plus CLAUDE.md's provenance fields); added `SyntheticFixtureFile`, the
  on-disk fixture shape (`Omit<SyntheticFixture, 'thresholds'>`).
- `data/thresholds.ts` — new canonical, versioned `SeasonThresholds[]` table: the real
  2025-26/2026-27 figures from §2, both `isProjected: false`. This is the single
  source of truth every team page reads from; nothing else hardcodes threshold
  numbers.
- `data/fixtures/synthetic.json` — dropped the embedded `thresholds` array. It was
  real, sourced data sitting inside a file whose own header says "all figures are
  fabricated" — a fixture-shape problem, not a schema one. `app/page.tsx` now composes
  `SEASON_THRESHOLDS` with the fixture's `capCharges` at load time.
- `lib/verify/reconcile.ts` — pure `sumCharges`/`reconcile` functions (±$1 tolerance
  per spec §3/§9), independent of the CLI so M3's ingestion adapters can reuse them
  directly.
- `scripts/verify.ts` — CLI wrapper (`pnpm verify`, runs via `tsx`). Sums the synthetic
  fixture's charges per season, checks against hand-verified expected totals in
  `data/fixtures/synthetic.expected.ts` (2025-26: $208,850,000; 2026-27: $200,950,000
  — computed once via a throwaway `node -e` sum, not eyeballed), and exits non-zero
  with a per-field actual/expected/diff breakdown on any mismatch >$1. Verified both
  the pass path and the failure path (a deliberately wrong expected total against
  `reconcile()` directly) exit correctly.
- `lib/chart/__tests__/labels.test.ts` — Vitest suite (13 tests) for
  `classifySegments`, `collapseSmallToOthers`, and `resolveCallouts`: inside-vs-outside
  by height and by width independently, the "Others (n)" collapse with an exact
  capHit-weighted-mean check, no-collision passthrough, a dense identical-idealY
  cluster, a mixed dense-cluster-plus-outlier case, and both bounds-clamping
  directions.
- Added `vitest` and `tsx` as devDependencies (neither existed before M2); wired
  `pnpm test` (already `vitest run` from M1's placeholder) and `pnpm verify`.

### Decisions made along the way
- **Two-way contracts get no `chargeType` variant.** CLAUDE.md says they're "excluded
  from stacks," but §2's schema doesn't define a `'two_way'` variant either. Rather
  than add one and then filter it out, the simplest reading that satisfies both is:
  two-way deals are just never emitted as `CapCharge` rows at all (they don't count
  against team salary, so there's nothing for a stack-building function to exclude).
  Nothing in the fixture conflicted with this, so no fixture change was needed here —
  flagged as a judgment call, not silently assumed.
- **Expected totals for `verify.ts`'s smoke test are self-sourced.** There's no
  independently published total to check the synthetic fixture against pre-M3 (that's
  the point of M3's real ingestion). Hand-summed the fixture's own `capCharges` once,
  stored that as `SYNTHETIC_EXPECTED_TOTALS`, and treat it as the "known good" figure
  the CLI checks the itemized rows against. The value isn't auditing this fixture's
  realism — it's exercising the exact reconciliation/tolerance/non-zero-exit/error-
  message mechanics that M3 will point at a real published total.

### Found and fixed: `resolveCallouts`'s backward pass was dead code
While writing the "dense collisions requiring multiple passes" test, discovered that
the reverse (push-up) sweep in the original `lib/chart/labels.ts`'s `resolveCallouts`
could **never fire**, on any input. The forward pass ran left-to-right over an array
already sorted ascending by `idealY`, and each step set `positions[i] = max(original,
positions[i-1] + lineHeight)`. That alone guarantees `positions[i] - positions[i-1] >=
lineHeight` for every adjacent pair once the forward pass completes — exactly the
condition the backward pass's `if (positions[i] > maxY)` check needed to do anything,
already false by construction. Confirmed empirically with a throwaway `tsx -e` probe
before touching the code:
```
dense identical [50,50,50,50,50] → [50, 66, 82, 98, 114]   // cascades from item 0
mixed [0,5,10,15,200,205]        → [0, 16, 32, 48, 200, 216]
```
A dense cluster always cascaded entirely downward from the topmost item's own ideal
position, instead of settling bidirectionally around the cluster's center — what the
spec's "push down, then push up in reverse until stable" description (and the
`d3-force forceY`-alternative it names) both imply.

Flagged this to the user mid-session with the choice to leave it or fix it now; asked
to fix it. **Replaced the forward/backward sweep with pool-adjacent-violators (PAVA)**
— the standard isotonic-regression technique for "place points as close as possible to
their ideal value subject to a minimum-spacing constraint." Sorted ascending by
`idealY`, scan left to right maintaining a stack of clusters; merge the incoming point
into the top cluster whenever it's closer than both clusters' combined spacing would
require once expanded (`lineHeight * (countA + countB) / 2`), repeating the merge
check against the shorter stack. Each final cluster expands into individual positions
evenly spaced by `lineHeight` around its own mean. This genuinely centers a dense
group around its own ideal-Y average rather than cascading from one end:
```
dense identical [50,50,50,50,50]      → [18, 34, 50, 66, 82]      // mean 50, symmetric
mixed [0, 5, 10, 200] (spec §5 test)  → [-11, 5, 21, 200]         // trio mean 5, centered; outlier untouched
```
The `maxIterations` parameter was dropped — PAVA's merge-stack is naturally O(n), no
iteration cap needed. No caller passed it explicitly, so this isn't a breaking change
to any call site. Updated `lib/chart/__tests__/labels.test.ts`'s dense-cluster and
mixed-cluster tests to assert the new centered values (with an explicit symmetry
check: the resolved cluster's mean equals its ideal mean) instead of documenting the
old cascade. The bounds-clamping tests needed no changes — same block-shift logic,
and the new centered pre-clamp positions still land on the same clamped values in both
of those specific test cases.

Also re-verified against the running chart, not just the unit tests: started `next
dev`, curled `/`, confirmed a 200 response, exactly one `<svg>`, and no "Others (n)"
callout in the default (non-collapsed) view — i.e. no runtime error from the algorithm
change. Did not redo M1's full Playwright screenshot pass across breakpoints; that's
a heavier visual-regression check than a package-swap-free algorithm fix warrants, but
a future session touching the chart visually should look at how dense clusters render
now (they'll sit centered in the plot rather than pinned to their topmost member).

### Verified
- `npx tsc --noEmit` clean.
- `npm run build` — production build + static export succeeds.
- `npm test` — 13/13 Vitest tests pass (updated after the `resolveCallouts` fix).
- `npm run verify` — both seasons reconcile against their expected totals; separately
  confirmed the failure path (non-zero exit, per-field diff message) against a
  deliberately wrong expected total.
- `next dev` + curl smoke check on `/` after the `resolveCallouts` rewrite (200, one
  `<svg>`, no server errors).

### Known gaps (carried forward)
- Pre-existing `npm audit` high-severity findings (postcss/sharp, both transitive
  through `next`) are unrelated to this session's changes and out of scope — not
  investigated further.
- No data table equivalent, no axe-core, no full contrast audit — still M6, unchanged
  from M1.
- `resolveCallouts`'s fix wasn't re-verified with a full visual/Playwright pass across
  breakpoints — only a curl smoke test. Worth a visual check next time the chart is
  touched, to confirm dense clusters read well now that they're centered rather than
  cascaded.

## M3 — CBA rules engine + one ingestion adapter (2026-07-25)

Built `lib/cba/` and one real ingestion adapter (Basketball-Reference, OKC only), per
the M3 instructions. No routing, no league-wide view, no looping across all 30 teams —
that's explicitly scoped to a follow-up session once the user hand-checks this team's
output against the source page.

### Blocker resolved before any code was written
`DATA-SOURCING.md` confirmed the architecture (derive-from-primitives) but the actual
source field was a literal unfilled template placeholder (`[your source]`) — the
"Constraints" section documented Basketball-Reference's rate limits, but nothing said
BR had actually been chosen/cleared as the primitives source, just that *if* scraped,
those were its terms. Per the session instructions, stopped and asked rather than
assuming. User confirmed Basketball-Reference. Updated `DATA-SOURCING.md` to record
this as settled, plus two more open decisions the user resolved before implementation:
the adapter's User-Agent contact string (placeholder domain, flagged as TODO — no real
domain exists yet) and how `verify.ts` reconciles real data (against the source page's
own reported total, not an externally-known "true" figure — see below).

### What's here
- `lib/cba/types.ts`, `contract.ts`, `engine.ts`, `season.ts`, `index.ts` — the rules
  engine. `ContractPrimitives` (one `ContractYearTerm` per season: salary, guarantee
  status/amount, option type/decided) is the input; `deriveCapCharges` turns it into
  one `player` CapCharge per season. `deriveDeadMoney` handles waivers, stretched or
  not, from `WaiverPrimitives`. Two contract builders: `linearRaiseContract` (start
  salary + fixed raise % applied linearly off the first year's salary — the actual
  CBA raise rule, not compounded year-over-year) for hand-built test contracts, and
  `explicitScheduleContract` (per-season dollar figures already known) for the real
  adapter, since Basketball-Reference's table already publishes the resolved salary
  for every season rather than a start+raise% pair.
- `lib/cba/__tests__/engine.test.ts` — 17 tests against four hand-constructed
  contracts per the session brief: a max deal (linear 8% raises), a rookie-scale deal
  (years 3-4 team options, undecided → asserts those seasons come back
  `derivation: 'estimated'` while locked-in years stay `'computed'`), a stretched
  waiver (2 remaining years spread over 2×2+1=5 seasons, with a deliberately
  non-round total to exercise the rounding-remainder-on-last-season path), and a
  partial guarantee (asserts `capHit` stays the full scheduled salary while rostered —
  guarantee status affects dead-money exposure if waived, not the while-rostered cap
  charge — and that omitting an explicit `guaranteedAmount` for a partial guarantee
  throws rather than silently defaulting).
- `scripts/ingest/basketball-reference/fetch.ts` — `fetchRobotsPolicy` parses the
  `User-agent: *` block's `Crawl-delay` directive from robots.txt at runtime (throws
  if absent rather than assuming a fallback number). `fetchTeamContractsPage` does one
  sequential request, caches raw HTML to `.cache/basketball-reference/` keyed by
  team+date (gitignored), and throws `AbortRunError` immediately on 429/403 with no
  retry. Real robots.txt fetched this session: `Crawl-delay: 3` under `User-agent: *`.
- `scripts/ingest/basketball-reference/parse.ts` — pure function, HTML in, primitives
  out, no network/fs. Reads the season→column mapping straight from the table header's
  `aria-label`s (no season-arithmetic guessing), the raw dollar figure from each cell's
  `csk` attribute (not the formatted text), and option type from BR's own `salary-tm`
  (team option) / `salary-pl` (player option) CSS classes. Also exports
  `parseReportedTotals`, which reads the page's own "Team Totals" tfoot row — an
  aggregate BR publishes independently of any parsing this adapter does.
- `scripts/ingest/basketball-reference/index.ts` — orchestrates robots policy → fetch
  → parse → `deriveCapCharges` → flat `CapCharge[]`, alongside the reported totals.
  `scripts/ingest/run.ts` calls this for `'OKC'` only and writes
  `data/teams/okc.json` (`{ teamId, teamLabel, capCharges, reportedTotals }`). Wired to
  `pnpm ingest` (previously a stub that exited 1).
- `scripts/ingest/basketball-reference/__tests__/` — `fetch.test.ts` tests
  `parseCrawlDelay` against BR's real robots.txt text (frozen, no network in tests).
  `parse.test.ts` tests `parseTeamContractsPage` against a frozen fixture of the real
  OKC page (fetched this session, single request, saved under `fixtures/`) — asserts
  two-way contracts (Dix, Barnhizer, Oweh — all-blank salary rows) emit no contract at
  all, the tfoot "Team Totals" row isn't mistaken for a player, player/team option
  columns are tagged correctly (SGA's final year, Wallace's year one), and the
  ambiguous-guarantee resolution described below against two real rows (Hartenstein,
  Mitchell).
- `scripts/verify.ts` — extended (not replaced) with `verifyOkcIngestion()`: reads
  `data/teams/okc.json` if present (skips cleanly if `pnpm ingest` hasn't been run
  yet), and reconciles the itemized `capCharges` for each season against that page's
  own reported total, ±$1, reusing the existing `reconcile`/`sumCharges` helpers.
  Per the user's explicit choice, this is an internal-consistency check (would catch a
  parsing bug — missed row, wrong season, double-counted charge) — it is deliberately
  NOT reconciled against an external "known-correct" payroll figure, since building
  one would mean either the user supplying it or this session reconstructing real
  salary figures from model knowledge, which CLAUDE.md forbids.
- Added `cheerio` as a dependency (HTML parsing for `parse.ts`); no prior HTML-parsing
  library existed in the repo.

### Real-world parsing details worth knowing
- **Guarantee status isn't fully explicit on this page.** BR marks a season's salary
  cell in `<em>` when it's "not fully guaranteed" (per the page's own legend) but only
  publishes one aggregate "Guaranteed" dollar total for the whole remaining contract,
  not a per-season split. When exactly one remaining season is marked this way, the
  parser resolves its exact guaranteed amount by subtraction (aggregate total minus
  the sum of the seasons NOT marked `<em>`) — this is arithmetically exact, not a
  guess. Verified against two real OKC rows: Hartenstein's 2028-29 (a mutual option,
  italicized, resolves to exactly $0 guaranteed) and Mitchell's 2026-27 (resolves to
  $0, matching the hidden payroll-notes text "2026-27 is not guaranteed"). If more than
  one remaining season were ever marked `<em>` for the same contract, the split
  genuinely can't be recovered from this table alone — the parser downgrades that
  whole contract's `derivation` to `'estimated'` and logs a warning, rather than
  guessing a split. Didn't occur in OKC's real current roster, so untested against a
  live example, only reasoned through.
- **`optionDecided` is conservatively always `false`/unset for every option-marked
  season the parser emits**, regardless of which column it's in. BR's own
  option-exercise dates (e.g. "Option exercised October 19, 2025") live in a
  `payroll-notes` table that's wrapped in an HTML comment on the live page (a lazy-load
  pattern) and isn't part of the parsed DOM at all — extracting it would mean parsing
  HTML-comment contents as markup, which this session judged as more fragile than
  valuable for M3's scope. This means some seasons that are, in reality, already
  decided (e.g. Wallace's 2026-27 team option, confirmed exercised in the hidden notes)
  still come back `derivation: 'estimated'` rather than `'sourced'` — an
  over-conservative simplification (never overconfident, per CLAUDE.md), not a bug.
  Worth revisiting if the `payroll-notes` table turns out to be worth parsing later.
- **BR's contracts page is a signed-contracts table only.** It has no rows at all for
  cap holds, draft-rights holds, or incomplete-roster charges — those chargeTypes
  exist in the schema (§2) but nothing in this adapter can currently populate them.
  OKC's real books didn't need any for the reconciliation to pass (verify.ts's
  itemized sum matched BR's own reported total exactly, ±$0, for all five seasons on
  the page), but this is a real gap for any team/season where those charge types
  matter, flagged in `DATA-SOURCING.md` rather than silently absent.

### Verified
- `npx tsc --noEmit` clean.
- `npm test` — 42/42 Vitest tests pass (17 CBA engine + 12 adapter + 13 carried over
  from M2).
- `npm run ingest` — ran end-to-end against the live Basketball-Reference OKC page:
  fetched `robots.txt`, read `Crawl-delay: 3`, made one request to
  `/contracts/OKC.html` (HTTP 200), cached it, parsed 14 contracts (17 roster rows
  minus 3 two-way signees), wrote 42 `CapCharge`s to `data/teams/okc.json`.
- `npm run verify` — both the M2 synthetic-fixture pass and the new OKC pass are
  green: all five seasons on OKC's real contracts page (2026-27 through 2030-31)
  reconcile to BR's own reported total, ±$0 exactly (not just within the ±$1
  tolerance).
- `npm run build` — production build + static export succeeds.

### Known gaps / next steps
- **Not yet hand-checked by the user against the source page** — this is the
  explicit gate before the adapter touches any other team (per the M3 instructions).
  `data/teams/okc.json` is sitting there for that review now.
- Cap holds, draft-rights holds, incomplete-roster charges: no source wired up yet
  for any of these chargeTypes (see above).
- `optionDecided` is always conservative/`false` — see above; a real per-season
  decided/undecided signal would need parsing BR's HTML-comment-wrapped
  `payroll-notes` table, deliberately not attempted this session.
- No commercial licensing (e.g. a Spotrac quote) was pursued — out of scope for this
  session, would only matter if a future milestone needs data BR's contracts page
  doesn't cover.
- Looping all 30 teams, and everything routing/league-view related, is explicitly
  out of scope for this session — next M3 follow-up.

## M3 follow-up — loop ingestion across all 30 teams (2026-07-25)

Generalized the single-team (OKC-only) Basketball-Reference adapter into a full
30-team run, per the OKC hand-check having passed. No routing, no league-wide view,
no automation/scheduling — those stay M4/M9, unchanged from the M3 instructions.

### What's here
- `scripts/ingest/basketball-reference/teams.ts` — `NBA_TEAMS`: all 30 BR contract-page
  slugs + labels. Several don't match the common abbreviation and were sourced from
  BR's own site nav, not assumed from convention: Nets = `BRK`, Hornets = `CHO`,
  Suns = `PHO`.
- `scripts/orchestrate.ts` — new CLI (`pnpm orchestrate` / `npm run orchestrate`),
  separate from the existing OKC-only `scripts/ingest/run.ts` (`pnpm ingest`), which is
  untouched. Loops `NBA_TEAMS` sequentially, reusing the exact same
  fetch/parse/`deriveCapCharges` modules the single-team adapter already built — this
  file is the loop, not a second pipeline implementation.
  - Robots.txt is fetched **once** for the whole run, not once per team — it's one
    site-wide policy, and re-fetching it 30 times would just be 30 extra requests
    against BR for no reason.
  - Crawl-delay is tracked across **live** requests only. A cache hit makes no
    request, so it doesn't reset the delay clock or force an artificial wait before
    the next team's live fetch — this required adding `fromCache: boolean` to
    `fetchTeamContractsPage`'s return (`scripts/ingest/basketball-reference/fetch.ts`),
    since previously nothing distinguished a cache hit from a live fetch by return
    value alone.
  - A `429`/`403` (`AbortRunError`) aborts the **entire run** immediately, per
    `DATA-SOURCING.md`'s constraints — this propagates up uncaught. Any other
    per-team failure (a network error, or HTML that doesn't match what the parser
    expects) is caught **per team**, recorded, and the loop continues to the next
    team rather than crashing the whole run.
  - Writes `data/teams/<slug-lowercase>.json` per team (same shape as `okc.json`).
  - Builds its own end-of-run summary (pass/fail per team, and for failures: which
    field/season/diff, plus a same-adapter chargeType-subtotal breakdown as a
    debugging hint — not an independently-sourced breakdown, since BR only publishes
    one aggregate total per season).
- `lib/verify/teamFile.ts` — new. Pulled the per-team-file reconciliation logic
  (season loop, expected-totals construction, `reconcile()` call) out of
  `scripts/verify.ts`'s old OKC-only `verifyOkcIngestion` into a pure
  `reconcileTeamFile()` + the shared `TeamCapChargesFile` type, so `verify.ts` and
  `orchestrate.ts` both call the identical reconciliation code instead of
  `orchestrate.ts` reimplementing it or shelling out to `verify.ts` as a subprocess.
- `scripts/verify.ts` — generalized: `verifyOkcIngestion()` (hardcoded to
  `data/teams/okc.json`) replaced with `verifyTeamData()`, which reads every `*.json`
  in `data/teams/` and reconciles each via `reconcileTeamFile()`. `pnpm verify` now
  covers whatever's actually on disk, not just OKC — running it after `pnpm ingest`
  (OKC only) or after `pnpm orchestrate` (all 30) both work, and it degrades to a
  clean skip message if `data/teams/` doesn't exist yet.
- Added an `"orchestrate"` script to `package.json` (`tsx scripts/orchestrate.ts`),
  alongside the existing `"ingest"` script, not replacing it.

### Full pass/fail summary
**30/30 teams passed reconciliation** against Basketball-Reference's own reported
per-season "Team Totals" figure, ±$0 (not just within the ±$1 tolerance), across every
season present on each team's page. Zero failures. Ran live against BR once (30
sequential requests, 3000ms crawl-delay honored between each, matching the
`Crawl-delay: 3` in their `robots.txt`); re-running the same day hit the on-disk cache
for all 30 teams (0 live requests, 2.5s total), confirming the cache-freshness-window
skip logic works across a multi-team run, not just the single-team case.

### A real pattern found, not a bug (flagged, not silently fixed)
**9 contracts across 8 teams** came back `derivation: 'estimated'` instead of
`'sourced'`: Detroit (John Collins, Duncan Robinson), Houston (Bruce Thornton),
Indiana (Jay Huff), Memphis (Quinten Post, Scotty Pippen Jr.), Miami (Myron Gardner),
Portland (Robert Williams), Washington (Khris Middleton). Every one hit the same known
limitation documented after the OKC-only session: when **two or more** remaining
seasons on a contract are marked "not fully guaranteed," BR's page only publishes one
aggregate guaranteed-dollar total for the whole contract, not a per-season split, so
the exact guarantee amount for those seasons genuinely isn't recoverable from this
table — the parser correctly downgrades the whole contract to `'estimated'` and logs a
warning rather than guessing a split. This was reasoned-through but untested against a
live example in the OKC-only session; now confirmed as a real, recurring pattern once
observed across all 30 teams' actual rosters. It didn't affect reconciliation (the
season *total* dollar figure is still exactly right; only the guarantee-status label
for those specific seasons is conservative rather than sourced) and was not
"fixed" — there's nothing to fix without a second data source that publishes the
per-season split, which doesn't exist in this table.

### Known gaps (carried forward, unchanged in kind, now confirmed at scale)
- Cap holds, draft-rights holds, incomplete-roster charges: still no source wired up
  for any of these `chargeType`s, for any team. Didn't block reconciliation for any of
  the 30 teams this run (none of their current books needed one to match BR's
  reported total), but remains a real gap for whichever team/season eventually does.
- `optionDecided` is still always conservative/`false` for every option-marked season,
  for the same reason as the OKC-only session (BR's option-exercise dates live in an
  HTML-comment-wrapped `payroll-notes` table, deliberately not parsed).
- No commercial licensing pursued — still out of scope, unchanged.
- Routing, the league-wide `/` view, and ingestion automation/scheduling remain
  explicitly out of scope (M4/M9), per this session's instructions.

### Verified
- `npx tsc --noEmit` clean.
- `npm test` — 42/42 Vitest tests pass, unchanged (no test-affecting logic changed;
  `orchestrate.ts` reuses already-tested pipeline modules).
- `npm run verify` — 131 `OK`, 0 `FAIL` across the synthetic fixture's 2 seasons and
  all 30 teams' seasons.
- `npm run orchestrate` — live run: 30/30 teams passed, one live HTTP request per team,
  crawl-delay honored. Re-run same day: 30/30 cache hits, 0 live requests.
- `npm run build` — production build + static export succeeds.

## M4 — Routing and the league view (2026-07-25)

Built `/`, `/team/[slug]`, and `/team/[slug]/[season]` reading from real M3 ingestion
output, per spec §6/§10. No `/compare`, `/player`, or public-surface pages (M7); no new
accessibility work beyond what M1 already built (M6).

### Chart reuse (agreed with the user before writing any code)
- `PayrollChart` (M1) already took a generic `{teamId, teamLabel, thresholds,
  capCharges}` prop, misnamed `SyntheticFixture` — renamed to `TeamPayrollData`
  (`lib/types.ts`) since it now renders real data too; pure rename, no shape change.
  Added one prop, `seasons?: Season[]`, to restrict which seasons render. That single
  addition covers both new team routes with no branching: `/team/[slug]` passes a
  (currently full, since only one season is available — see below) range, and
  `/team/[slug]/[season]` passes a one-element array. `focusSeason` (already existed,
  unused until now) is now wired from the URL; both it and the y-scale's domain
  (`buildYScale` call) were changed to derive from the *filtered* `seasons`, not
  `fixture.thresholds` wholesale, so a season outside the current range can't stretch
  the axis or become an invalid sort key.
- The league view (`/`) is a genuinely different geometry — money on x, one row per
  team, no per-player labels at 30-row scale — so it's a new component
  (`components/league/LeagueOverview.tsx`), not `PayrollChart` rendered smaller.
  "Reuse the chart primitives, not a second rendering path" was satisfied at the math
  layer instead: `buildStackOrder`/`stackSeason` (`lib/chart/stack.ts`, already
  orientation-agnostic — bottom/top are just cumulative dollars), `bandOverages`
  (`lib/chart/thresholds.ts`) for the same over-threshold shading, `MECHANISM_COLORS`,
  and a new `dollarDomainCeiling` pulled out of `buildYScale`
  (`lib/chart/scales.ts`) so both the vertical (team page) and horizontal (league)
  dollar scales compute the same axis-ceiling formula once instead of twice.

### Three decisions the user made before implementation (AskUserQuestion)
1. **Real per-team data (2026-27 through as far as 2031-32) vs. `data/thresholds.ts`
   (only 2025-26/2026-27, per spec §2's literal figures) — restrict to seasons with
   real thresholds**, rather than extending the table with projected out-year
   figures this session. `lib/data/teamPayroll.ts`'s `availableSeasonsFor()`
   intersects a team's charge seasons with `SEASON_THRESHOLDS`' seasons — currently
   resolves to exactly `['2026-27']` for every team, so the season-range/focus
   selector (built generically, see below) is dormant until a later session extends
   the threshold table. `PayrollChart` already skipped seasons with no matching
   threshold entry rather than crashing (M1 behavior, unchanged), so this is a data
   decision, not a defensiveness gap.
2. **League bars segmented by mechanism** (same color encoding as the team page,
   mirrored horizontally, no text labels — 30 rows has no room — but a `<title>`
   tooltip per segment), not a single flat total-payroll bar.
3. **League view's single shared season**: most recent season with both real charges
   and real thresholds, no toggle in M4. `app/page.tsx`'s `pickLeagueSeason()`
   computes this from `SEASON_THRESHOLDS` ∩ charge seasons rather than hardcoding
   `'2026-27'`, so it tracks forward once the threshold table is extended.

### What's here
- `lib/data/teams.ts` — server-only (fs-based): `listTeamSlugs()` (derives the 30
  routing slugs from `data/teams/*.json` filenames — no second hardcoded team list)
  and `loadTeamFile(slug)`, which never throws (`{ok:true,...} | {ok:false,error}`).
- `lib/data/teamPayroll.ts` — pure (no fs), split out from `teams.ts` specifically so
  `TeamPageClient` (a client component) can import `toPayrollData`/
  `availableSeasonsFor` without pulling `node:fs`/`node:path` into the browser
  bundle. Found this the hard way: an initial single-file version broke the
  production build with a webpack `UnhandledSchemeError` on `node:fs` the moment a
  `'use client'` file imported anything from it, even an unused export.
- `app/page.tsx` — league view. Loads every team file, computes the league season,
  sorts by total descending, renders `<LeagueOverview>`. Teams that fail to load are
  omitted from the chart and named in a footer note rather than crashing the route
  (M4 requirement #5) — didn't occur with today's data (M3: 30/30 passed
  reconciliation) but is real, exercised code, not speculative.
- `components/league/LeagueOverview.tsx` — the league chart. One `<svg>`, thin
  horizontal bars, shared vertical threshold lines. Threshold *values* are a
  fixed-order legend line above the chart, not text positioned at each line's true
  x — found via the chrome browser tool that positioning them inline collided
  ("Tax $200.4MApron 2 $221.7M" overlapping with no space) because spec §2's four
  thresholds span only ~$57M, compressed into a plot width where even non-adjacent
  labels sit close enough to touch. A legend line has no such failure mode regardless
  of width, same reasoning as PayrollChart's own per-season threshold header (M1).
  Team rows show the 3-letter teamId (not the full label — nameColumn is as narrow as
  44px at small widths) as a clickable link to `/team/{slug}`; full name is in the
  link's `<title>` and the row's `aria-label`.
- `app/team/[slug]/page.tsx` + `components/team/TeamPageClient.tsx` — the season
  range/focus-season controls read from and write to the URL (`?from=&to=&focus=`,
  spec §10) via `useSearchParams`/`router.replace`. Only rendered when
  `availableSeasons.length > 1` (currently never, per decision 1) — the instruction
  was "season range selector if multiple seasons are present in the data; otherwise
  render what's available," so a single-season team correctly shows no selector at
  all, just the chart. `useSearchParams` requires wrapping in `<Suspense>`
  (Next.js requirement) or the build fails; added a `PayrollChartFallback` skeleton
  that only ever flashes on client-side navigation, not first load.
- `app/team/[slug]/[season]/page.tsx` — deep link. `generateStaticParams` returns
  every `{slug, season}` pair currently in range for each team (30 teams × 1 season
  today). An unknown slug or a season outside that team's `availableSeasonsFor()`
  both `notFound()` (verified: `/team/zzz` and `/team/okc/2099-00` both 404;
  `/team/okc`, `/team/okc/2026-27`, and a full `?from=&to=&focus=` query all 200).

### Verified
- `npx tsc --noEmit` clean.
- `npm test` — 42/42 Vitest tests pass, unchanged.
- `npm run verify` — unchanged, 131 OK / 0 FAIL.
- `npm run build` — production build succeeds; `/`, all 30 `/team/[slug]`, and all 30
  `/team/[slug]/[season]` (2026-27 only, per decision 1) statically generated via
  `generateStaticParams`.
- Actually opened the running app in a real browser (via the claude-in-chrome tool,
  on the machine's own Chrome, after the first attempt on a paired Windows browser
  failed since the dev server only runs on this machine — confirmed by trying its
  LAN address, which returned a Chrome network error) and visually checked: the
  league view (all 30 teams, sorted descending $226M→$150.8M, legend + threshold
  lines + shading render correctly, team code links navigate to team pages); a real
  team page (Cleveland — Donovan Mitchell/Mobley/Harden/Allen/Strus/Schröder inside
  labels, real small-contract callouts in the right margin merged with threshold
  labels, apron-2 shading visible); the single-season deep link; and that the season
  selector is correctly absent (one season available). One real hydration console
  warning appeared but traced to a `Dark Reader` browser extension injecting
  `data-darkreader-*` attributes onto `<html>` before React loaded — not an app bug.
  **Not verified this session**: actual 390px-width rendering in a real browser — the
  browser tool's `resize_window` call reported success but `window.innerWidth` stayed
  at 1440 regardless (checked via injected JS), so the narrow-viewport screenshot
  never actually happened. Confidence it still holds comes from the code, not a
  screenshot: `LeagueOverview` reuses the exact same clamped-margin-scales-with-`width`
  pattern M1 built and Playwright-verified at 390px for `PayrollChart`, and
  `PayrollChart` itself is untouched in its width-handling logic this session (only
  the `seasons` prop and the y-scale's threshold source changed). Worth an actual
  narrow-viewport screenshot next time a session has working device emulation.

### Known gaps (surfaced, not fixed — out of this session's stated scope)
- **`derivation: 'estimated'` charges aren't visually distinguished from `'sourced'`
  ones anywhere in the chart** — CLAUDE.md's "Estimated values are visually distinct
  from sourced ones. No exceptions" isn't implemented; this predates M4 (nothing in
  M1–M3 built it either) but is now reachable with real data for the first time (9
  contracts across 8 teams came back `'estimated'` per the M3 follow-up session,
  e.g. Detroit's John Collins). Left alone because the user's M4 instructions
  explicitly bounded this session to routing and said not to touch accessibility/
  visual-encoding work beyond what's already in place — flagging it here rather than
  silently expanding scope.
- **Projected-threshold dashing is similarly unimplemented at the line level** — a
  threshold's `isProjected` flag only changes its text label (" (projected)"/" (proj.)"),
  not its actual dash pattern, which is fixed per threshold type regardless. Doesn't
  manifest today (every season currently rendered has `isProjected: false`), so it's
  latent rather than visibly wrong, but will need fixing whenever thresholds.ts grows
  projected out-years (decision 1, above).
- Season range/focus-season selector UI is built and wired to the URL but exercises
  against exactly one season for every team today — genuinely untested against a
  multi-season range because no team currently has one. Next session that extends
  `data/thresholds.ts` should double back and click through it.
- `/compare`, `/player`, and all public-surface pages (`/methodology`, `/sources`,
  `/glossary`, `/corrections`, `/about`, `/privacy`) remain unbuilt — explicitly out
  of M4's scope (M7+).
- `next.config.mjs` still has no `output: 'export'` — noticed while adding
  `generateStaticParams`-based dynamic routes (which work fine either way, but
  matter more once static export is actually turned on). Pre-existing from M1–M3,
  not touched this session; flagged since M4 is the first session to add routes
  that depend on how that's configured.

## M5 — Interactions (2026-07-25)

Built hover-highlight, click-to-pin, the toggle set, and keyboard navigation on
`PayrollChart`/`/team/[slug]`/`/team/[slug]/[season]`, per spec §6. No touches to
the accessibility audit (contrast, ARIA labels, table equivalent, axe-core — M6)
or the public-surface pages (M7). The league view (`/`) was intentionally left
alone — confirmed with the user upfront — since it's a different geometry with no
per-player labels and no fixed stack order to pay off.

### State model (confirmed with the user before writing code)
Three tiers, kept from drifting apart by having exactly one place translate
between them:
- **Ephemeral, component-local:** hover and keyboard-focus, each an
  `ActiveSegmentInfo | null` (`{entityId, label, amount, season}`) in
  `PayrollChart`'s own `useState`. Never touch the URL.
- **Persistent, URL-owned:** `pinnedEntityId`. Read/written only by
  `TeamPageClient` (`?pin=`), passed into `PayrollChart` as a controlled prop —
  same pattern M4 already used for `focusSeason`.
- **Toggle state, URL-owned:** one `ChartToggles` object (`lib/chart/toggles.ts`)
  — `basis`, `includeDeadMoneyAndHolds`, `dollarMode`, `guaranteedOnly` — not four
  loose props, so it can't partially drift. `TeamPageClient` owns the URL params
  (`basis`, `holds`, `dollars`, `guarantee`) and passes the whole object down.

Single precedence rule drives both the cross-season highlight and an on-chart
info readout, so the two can never disagree: `hoveredSegment ?? focusedSegment ??
pinnedInfo`. Hovering or tabbing to a different segment previews it even while
something's pinned; releasing falls back to the pinned one.

`/team/[slug]/[season]` now renders through `TeamPageClient` too (passing
`availableSeasons=[season]`, which auto-hides the range/focus selector since
`length > 1` is false, plus a `basePath` prop so URL updates stay on the
`/season` path instead of redirecting to the un-seasoned route) instead of
calling `PayrollChart` directly — one implementation of pin/toggle URL handling,
not a second, divergent one.

### What's here
- `lib/chart/stack.ts` — `buildStackOrder`/`stackSeason` take an optional
  `getAmount` accessor (default `c => c.capHit`, so every existing call site and
  M2's Vitest suite is untouched) so the toggle set can feed in a different
  per-charge amount without a parallel stacking implementation.
- `lib/chart/toggles.ts` — new. `ChartToggles`, `selectAmount` (basis selection +
  guaranteed-only reduction), `selectableCharges` (hold/dead-money exclusion +
  drops any charge whose guaranteed-only amount is exactly 0, so a 0-height
  segment never becomes a spurious "$0" callout), and the percent-of-cap display
  transform (`toDisplayStack`/`toDisplayThresholds`).
- `lib/format.ts` — added `formatPercent`, mirroring `formatAbbreviated`'s
  "$55.8M"-style rounding for the % dollar-mode toggle.
- `components/chart/PayrollChart.tsx` — hover/focus/pin wiring, the info
  readout, per-segment opacity dimming + stroke outline on the active segment,
  and reversed per-season segment render order (see below). New optional props:
  `toggles`, `pinnedEntityId`, `onPinChange`.
- `components/team/TeamPageClient.tsx` — pin + toggle URL params, a toggle UI row
  (basis select, three checkboxes), a `basePath` prop for the season deep-link
  reuse described above.
- `app/team/[slug]/[season]/page.tsx` — now renders `TeamPageClient` (in
  `Suspense`, same as `/team/[slug]`) instead of `PayrollChart` directly.

### Decisions made along the way
- **Apron shading follows the basis toggle (asked the user, not assumed).**
  CLAUDE.md says apron thresholds compare against `apronHit` only; the new
  cap/tax/apron basis toggle raised a real question of whether that rule means
  "always apronHit regardless of the toggle" or "whatever's currently selected."
  Asked directly rather than picking a reading — the user chose **coupled**: the
  whole chart (bars, total, and all four threshold comparisons) uses the
  selected basis's Hit value together, so the chart always honestly answers "how
  does *this* payroll lens compare to these reference lines," with the active
  basis clearly labeled. Threshold line dollar values themselves are never
  toggle-scaled by basis (only by the separate percent-of-cap dollar-mode) — only
  which total gets tested against them changes.
- **Percent-mode is a display-only transform, isolated to two chart-internal
  types.** `toDisplayStack`/`toDisplayThresholds` produce scaled copies of
  `SeasonStack`/`SeasonThresholds` (chart-computed structures, not sourced
  `CapCharge` records) purely so `buildYScale`/`bandOverages`/`labels.ts` can stay
  completely unit-agnostic. The overage/shading *decision* (crossed a line or
  not) is always computed from the real-dollar, basis-selected total against
  real-dollar thresholds — scaling both sides of a `>` comparison by the same
  positive factor can't change the answer, so there was no need to duplicate
  that logic for percent mode. Tooltips/aria-labels always show exact dollars
  regardless of dollarMode, consistent with spec §5's "tooltips exact" rule.
  `CapCharge` itself is never touched by any toggle — provenance and the
  cents-free-dollar rule stay intact on the source data.
- **Guaranteed-only**: full-guarantee charges show their basis hit unchanged;
  `guaranteeStatus: 'none'` charges are dropped from the stack entirely (not
  rendered at $0); `'partial'` charges show `guaranteedAmount` (a single
  schema field, not split per basis) capped at the basis hit. Only
  `guaranteeStatus`/`guaranteedAmount` drive this — `optionType` isn't
  conflated in, since the schema doesn't tie the two together.
- **Real bug found and fixed during manual verification, not caught by
  types/tests:** a mouse click both pins a segment and, as a normal DOM side
  effect of clicking a focusable element, leaves it natively focused. Since
  `focusedSegment` drives the same highlight as hover (spec §6 item 4: focus
  shows the same info hover would), that lingering focus kept the highlight
  and readout stuck on screen indefinitely after a click — surviving mouse-away,
  and even surviving a second click that correctly unpinned it in the URL —
  because clicking empty space or elsewhere doesn't blur a previously focused
  element in any browser. Fixed with a `suppressNextFocusRef`, set on
  `onMouseDown` and consumed once in `onFocus`, so mouse-originated focus never
  populates `focusedSegment` — only real keyboard (Tab) focus does. This
  mirrors the same mouse-vs-keyboard distinction the existing
  `focus-visible:stroke-black` ring styling already made for the outline; the
  highlight logic just hadn't matched it. Found by actually clicking through
  the running chart in a browser, not by reading the code.
- **Tab order fix: reversed the per-season segment render order.** Segments are
  stacked bottom-up in `stack.segments` (largest earner first → dollar-0 →
  bottom of the bar), so the DOM/source order used to put the tab sequence
  bottom-to-top within a bar — backwards from spec §6 item 4 ("top to bottom
  within a bar, then to the next bar"). Rendering `[...stack.segments].reverse()`
  in the fills pass fixes the natural tab order without resorting to explicit
  `tabIndex` values; paint order doesn't matter since segments don't overlap.
  Verified live: tabbing through a two-season fixture moved top segment → down
  → into the next season's bar, top to bottom again.

### Verified
- `npx tsc --noEmit`, `npm test` (42/42), `npm run verify` (131 OK / 0 FAIL),
  `npm run build` all clean after every change, including after the focus-ring
  bug fix.
- Manual browser verification (claude-in-chrome), two passes:
  1. **Real data** (`/team/okc`): hover-highlight + dim, exact-dollar readout,
     and all four toggles confirmed live (URL updates, chart visibly changes
     for the dead-money-exclude and percent-of-cap toggles; basis and
     guaranteed-only toggles update the URL and don't crash, but have no
     *visible* effect on OKC's current data since `capHit === taxHit ===
     apronHit` for all real charges today and OKC's current roster has no
     non-fully-guaranteed seasons — confirmed via the underlying JSON, not
     assumed).
  2. **Synthetic two-season fixture** (`data/fixtures/synthetic.json`, composed
     through a temporary, not-committed preview route deleted at the end of the
     session): the only way to exercise multi-season behavior today, since
     `data/thresholds.ts` only overlaps real ingested data for one season (M4's
     known gap, unchanged) — no live route currently renders more than one
     season for any real team. Confirmed: hovering a player present in only one
     season highlights correctly there and simply doesn't highlight in the
     other (no error) for a fixture where the roster genuinely changes year to
     year; click-to-pin persists after the mouse leaves and after losing
     keyboard focus; clicking the same segment again unpins (URL param
     removed); keyboard Tab order goes top-to-bottom within the first bar, then
     correctly continues into the second bar's own top-to-bottom order,
     including through individually-tabbable segments whose *labels* are
     collapsed into "Others" in the margin (collapsing is label-only; every
     underlying segment is always its own accessible/tabbable element).

### Known gaps / next steps
- **`exceptionUsed` is never populated by the M3 Basketball-Reference adapter**
  (confirmed: 0 of OKC's 42 real charges have it set), so `mechanismFor` falls
  back to minimum-tier styling for every real standard contract today — every
  segment on a real team page renders the same color regardless of whether it's
  a supermax or a minimum deal. Pre-existing from M3, not a regression from this
  session (the color logic itself is untouched), surfaced here because it's now
  visibly reachable through real hover/toggle interactions for the first time.
  Would need the BR adapter taught to infer/derive an exception type — out of
  M5's scope.
- Basis and guaranteed-only toggles are wired correctly (verified against the
  synthetic fixture, where the fields actually diverge/vary) but have no
  visible effect on any real team today, for the reasons above — worth a
  targeted look once real `taxHit`/`apronHit` divergence or non-guaranteed
  real seasons exist in ingested data.
- League view (`/`) interactions (hover/pin/toggles on `LeagueOverview`)
  explicitly out of scope this session, per upfront confirmation with the user.
- Multi-season hover/pin/keyboard behavior is only verified against the
  synthetic fixture, not a real multi-season team — still blocked on the same
  M4 gap (`data/thresholds.ts` only covers one season that overlaps real
  ingested data). Next session that extends the threshold table should re-verify
  this against real data.

## M6 — Accessibility pass (2026-07-26)

Built the WCAG 2.1 AA pass per spec §9, on top of M5's interactions. Did not
touch the public-surface pages (M7) or OG images/sharing (M8).

### Baseline axe-core audit (run before any fixes, per the session's instructions)
Wired `@playwright/test` + `@axe-core/playwright` (Vitest+jsdom can't evaluate
real layout/contrast, needed a real Chromium render) and ran it against `/`,
`/team/okc`, `/team/okc/2026-27` before touching anything:

**3/3 routes failed, 1 violation each — all `nested-interactive` (serious, WCAG
4.1.2)**: both chart `<svg>`s used `role="img"`, which forbids focusable
descendants, but M5 deliberately built individually-focusable segments and an
expandable "Others" control into both charts. A real, valid finding, not caught
by M1–M5 despite those sessions building cheap a11y affordances (tabIndex,
aria-label, focus rings) — nothing before this session had run axe against the
actual role attribute.

axe's own contrast checker didn't flag anything, but its `color-contrast` rule
only evaluates CSS `color`, not SVG `fill` — it silently skips every colored
`<text>` in both charts. Computed the WCAG contrast formula by hand against
every color pair in the palette instead: found `MUTED_INK` (#898781) used as
**text** (not stroke) failed 4.5:1 against the page background (3.41–3.59:1
computed) in three places — PayrollChart's axis ticks, LeagueOverview's
per-row total label, and the "N teams could not be loaded" footer note on `/`.
The `MECHANISM_COLORS` ramp itself (already validated by the dataviz skill in
M1) was untouched and passes everywhere (5.4–9.9:1).

### Fixes
1. **Data table equivalent** (item 1, the one the instructions called most
   important): a visible toggle ("View as table" / "View as chart"), not an
   offscreen table — picked per the instructions' either/or, since one
   traversable structure at a time is simpler to keep in sync with the
   toggle-filtered chart data than a hidden duplicate. New
   `components/chart/PayrollTable.tsx` (team page) and
   `components/league/LeagueTable.tsx` (league view); each chart owns its own
   local `useState` view-mode toggle, not URL-persisted — a judgment call: the
   spec's "chart state lives in the URL" principle is about *what's plotted*
   (season range, toggles, pin), not view-mode-as-a-rendering-preference, and
   nothing in §9/CLAUDE.md asks for the toggle itself to be shareable.
   - `PayrollTable`: one row per cap charge, in the same fixed stack order as
     the chart — columns Season/Charge/Charge type/Mechanism/{basis} hit/
     Guarantee/Option/Derivation — plus a bold total row per season with signed
     distance to all four thresholds (`vs cap +$1.2M` etc.), the textual
     equivalent of the over-threshold shading. Reads the same
     already-toggle-filtered `stacks` PayrollChart itself renders from, so it's
     the same data the chart shows, not a second, divergent view.
   - `LeagueTable`: one row per team — total + signed distance to all four
     thresholds — not a full per-charge breakdown across 30 rosters, which
     would run to hundreds of rows for a bird's-eye league view. Each
     segment's own charge/amount is already reachable non-visually via its own
     aria-label on focus; this table is the "who's over which line, by how
     much" summary the shading itself conveys.
   - Bonus, not explicitly asked for but fell out for free: the `Derivation`
     column makes M4's known gap ("estimated charges aren't visually
     distinguished from sourced ones... no exceptions") visible as text for
     the first time — e.g. real OKC rows show Cason Wallace/Nikola Topić as
     `Estimated` right next to `Sourced` rows. Doesn't fix the chart's own
     visual-distinction gap (still open, still flagged from M4/M5, out of this
     session's explicit scope) but gives it a non-visual channel today.
2. **Contrast**: swapped all three `MUTED_INK`-as-text usages to
   `SECONDARY_INK` (#52514e, 7.53:1) — `PayrollChart.tsx`'s axis ticks,
   `LeagueOverview.tsx`'s total labels, `app/page.tsx`'s footer note. Left
   `MUTED_INK` in place for its remaining (non-text, stroke-only) uses — leader
   lines only need 3:1 per WCAG 1.4.11 and pass at 3.41–3.59.
3. **Color-alone confirmed, threshold dashes tightened**: the mechanism legend
   already pairs color with a text label (spec's own claim), and every segment
   carries its own textual identity via inside/callout labels regardless of
   color — confirmed, not changed. The one real gap found: a sighted colorblind
   user has no way to read a segment's *mechanism/tier* (as opposed to its
   identity) other than color, since no hatch/pattern was ever built for that
   axis (spec's guarantee-status hatching was the alternative encoding, and
   wasn't built either). Judgment call: didn't build per-segment hatching this
   session (real scope creep beyond what M6's instructions asked for) — the new
   table view's `Mechanism` column is the actual remedy, giving colorblind users
   a non-color channel to the same information. Separately, cap-vs-tax
   threshold lines were both solid, differing only by 0.5px width (practically
   imperceptible) — gave tax a `1,3` dotted dash in both chart components so
   all four threshold lines are told apart by line style alone, never color
   (every threshold line already shares one ink color, so this was never a
   literal WCAG 1.4.1 violation, just a weak non-color distinction worth
   tightening).
4. **Keyboard nav**: aria-label/tabIndex/focus rings on segments were already
   built in M5; this session's only change there was the `role` fix (item 1
   above). Manually verified via `.focus()` + a real `Enter` keydown (the
   claude-in-chrome tool's synthetic `Tab` key was flaky/unreliable in this
   environment — see below) that a focused segment's `Enter` correctly pins
   (`?pin=gilgesh01` appeared in the URL) and pins again to unpin. The skip
   link (item 6) was independently confirmed via computed-style inspection plus
   a real `Enter` keypress that correctly moved focus to `#main-content`. All
   toggle controls (basis select, three checkboxes, the new table-view button)
   are native `<select>`/`<input>`/`<button>` elements, keyboard-operable by
   construction.
5. **prefers-reduced-motion**: audited for every `transition`/`animate`/
   `@keyframes` in the codebase — found exactly one, Tailwind's `animate-pulse`
   on the two chart-loading skeletons (`app/team/[slug]/page.tsx`,
   `[season]/page.tsx`). The hover/focus/pin highlight itself has zero CSS
   transition (opacity/stroke are set directly as SVG attributes on each
   render — no animation ever existed there to guard). Added a
   `prefers-reduced-motion: reduce` override in `globals.css` disabling
   `animate-pulse`'s animation.
6. **Semantic structure**: skip link as the first focusable element in
   `app/layout.tsx` (`sr-only focus:not-sr-only`, targets `#main-content`;
   `id="main-content"`/`tabIndex={-1}` added to all four `<main>` elements
   across the three route files); `generateMetadata` added to both team route
   files for a real per-team/per-season `<title>` (previously every route
   rendered the same static "NBA Payroll Explorer" title regardless of team/
   season). Heading hierarchy was already trivially valid (exactly one `<h1>`
   per page, no other heading levels anywhere) — confirmed via grep, not
   changed.
7. **axe-core in CI**: `@playwright/test` + `@axe-core/playwright`, new
   `e2e/a11y.spec.ts`, `pnpm a11y` (previously a stub that printed "not written
   yet" and exited 1). Tests both the chart view and the new table view of all
   three routes (6 tests total) against `wcag2a`/`wcag2aa`/`wcag21a`/`wcag21aa`
   tags, logging the full violation list on failure. `playwright.config.ts`
   runs a real `next dev` webServer rather than a static export, since axe's
   contrast checks need actual computed styles.

### A real environment blocker, worked around
Latest Playwright (1.62.0) refuses to install its bundled Chromium on this
machine's macOS 13.7.8 ("Playwright does not support chromium on mac13").
Bisected to `@playwright/test@1.55.0`, which still installs and runs cleanly —
pinned in `package.json`. That created a second problem: `@axe-core/playwright`
independently pulls in the *latest* `playwright-core` (1.62.0) as its own
dependency, so two different `playwright-core` versions coexisted and `tsc`
failed with a structural `Page` type mismatch between the two (functionally the
test still ran and passed — this was a type-only conflict, not a runtime one).
Fixed with an npm `overrides` entry pinning `playwright-core` to `1.55.0`
everywhere; `npm ls playwright-core` now shows one deduped version and `tsc
--noEmit` is clean. Whoever next bumps Playwright should re-check this — the
mac13 ceiling is a real constraint on this machine specifically, not a version
chosen for any other reason.

### Also found, not fixed (informational)
- The claude-in-chrome browser tool's synthetic `Tab` keypress was unreliable
  in this environment — sometimes advanced focus once, then got stuck on the
  same element across repeated presses. Real `Enter` keypresses and
  programmatic `.focus()` calls worked reliably every time, so keyboard
  verification used those instead (see item 4 above) rather than a literal
  Tab-through. Reads as a tool/environment limitation, not evidence of an app
  bug: axe-core's `nested-interactive` check (which does validate focusable
  descendants are structured correctly) passed clean after the role fix, and
  the segments' own tabIndex/keydown code is unchanged from M5.
- The manual-verification browser session had the **Dark Reader** extension
  active (same one M4 noted), confirmed via `data-darkreader-*` attributes on
  `<html>`. It inverts every color in screenshots, including ones just fixed
  this session — irrelevant to real users, but worth remembering if a future
  session's screenshot-based check looks "wrong": trust the computed hex
  values and the WCAG formula, not a screenshot taken through this extension.

### Verified
- `npx tsc --noEmit` clean.
- `npm test` — 42/42 Vitest tests pass, unchanged.
- `npm run verify` — unchanged, all teams reconcile.
- `npm run build` — production build succeeds.
- `npm run a11y` — **6/6 pass, 0 violations** (chart view + table view × 3
  routes), down from the baseline's 3/3 routes failing with 1
  `nested-interactive` violation each.
- Manual browser verification (claude-in-chrome): per-route `<title>`
  confirmed correct ("Oklahoma City Thunder — NBA Payroll Explorer" on
  `/team/okc`); skip link confirmed to move focus to `#main-content` on
  activation; a focused segment's real `Enter` keypress confirmed to pin/unpin
  via the URL; the table toggle confirmed to render real data (screenshot:
  OKC's real 2026-27 roster, provenance columns visible, Cason Wallace/Nikola
  Topić correctly showing `Estimated` next to `Sourced` rows).

### Known gaps (carried forward / newly surfaced)
- **Chart-level visual distinction between `estimated` and `sourced` charges
  is still unimplemented** — unchanged from M4/M5's flagged gap. This
  session's table view gives it a textual channel but doesn't touch the
  chart's own rendering, since that wasn't in M6's instructions.
- **Per-segment mechanism/tier has no non-color channel *within the chart
  itself*** — only via the new table view. An actual hatch/pattern encoding
  (spec's alternative guarantee-status idea, never built for mechanism either)
  would be the more complete fix but is real scope beyond what this session's
  instructions asked for.
- View-mode (chart vs. table) is local component state, not URL-persisted — a
  shared link always reopens to the chart view. Flagged as a judgment call
  above; revisit if a future session decides "shareable" should include this.
- Table-view axe coverage exists for the three routes tested; `/compare` and
  `/player` don't exist yet (M7+) so weren't in scope.

## M7 — Public surface (2026-07-26)

Built the credibility/legal pages per spec §7/§8/§11: `/methodology`, `/sources`,
`/glossary`, `/corrections`, `/about`, `/privacy`, a site-wide footer disclaimer,
per-figure provenance in the chart/table, and "last updated" timestamps on team
pages. No OG images/sharing/SEO metadata (M8) and no deployment/scheduled
ingestion (M9) touched.

### Decision made before writing any copy
Per the session instructions, drafted a section-by-section outline of
`/methodology`'s content (pulled from actually reading `lib/cba/engine.ts`,
`contract.ts`, and `lib/chart/toggles.ts`/`thresholds.ts`, not described
generically) and got it confirmed before writing full copy. One real
discrepancy surfaced and flagged directly rather than silently resolved either
way: CLAUDE.md's rule "apron thresholds are compared against apronHit only"
doesn't match what M5 actually built — the Basis toggle changes which Hit
value all four threshold lines are compared against, not just apron-vs-apronHit.
User confirmed describing what the code actually does (this session's
instruction), so `/methodology` item 1 states the toggle behavior as truth and
flags the CLAUDE.md sentence as describing an earlier intent rather than
current behavior. Also asked the user for the contact email up front, since
the codebase's only existing placeholder for a real contact
(`scripts/ingest/basketball-reference/fetch.ts`'s `USER_AGENT`) is an
unregistered `<site-domain-tbd>` string — user provided `tronjopvp@gmail.com`,
used for `/corrections` and `/about`.

### What's here
- `app/methodology/page.tsx` — nine sections matching the confirmed outline.
  Items 6 (derivation counts) and part of item 6's "known display gap" note
  pull live numbers from a new `lib/data/stats.ts` (`computeDatasetStats()`,
  fs-based like `lib/data/teams.ts`) rather than hardcoding a snapshot from an
  earlier session's NOTES.md entry — deliberately not reused the M3
  follow-up's "9 contracts across 8 teams" figure (that count was specific to
  the multi-season-guarantee-split trigger only). Computed live, the real
  number today is 386 estimated charges across all 30 teams — most of that
  from the *other* estimation trigger (every option-bearing season being
  conservatively undecided), which the smaller M3-era figure never counted.
  Confirms the live-compute decision was the right call: a hardcoded number
  from that session would have been misleadingly small.
- `app/sources/page.tsx` — mirrors `DATA-SOURCING.md`: Basketball-Reference for
  contract primitives, NBA's own announced figures (hardcoded, not scraped)
  for thresholds, Spotrac explicitly named as not used and why, crawl-delay/
  caching policy stated for transparency, dataset snapshot stats (also via
  `lib/data/stats.ts`).
- `app/glossary/page.tsx` — 17 terms (salary cap through the site's own
  `derivation` labels), plain-language, general CBA-rule definitions — not
  team-specific salary figures, so this doesn't touch the "no reconstructing
  real salaries" rule.
- `app/corrections/page.tsx` — `mailto:` link (not a form with a backend: this
  is a statically-exported site with no server, and building one purely for a
  corrections form was judged out of M7's scope) with a pre-filled
  subject/body template, plus a visible log read from a new
  `data/corrections.ts` (`CORRECTIONS_LOG`, currently `[]`, same
  versioned-data-file convention as `data/thresholds.ts`). Renders "No
  corrections have been logged yet" explicitly rather than an empty table.
- `app/about/page.tsx` — what the site is, that it's an independent
  single-person non-commercial project (no real name available/asked for,
  so phrased around that rather than fabricating one), the trademark
  disclaimer (imported from `components/Footer.tsx` as the literal same
  constant, not a paraphrase), and the contact email.
- `app/privacy/page.tsx` — states plainly that there are no cookies, no
  analytics, no tracking scripts (verified against `package.json`: no
  analytics dependency exists in this codebase today), what a hosting
  provider might log by default once one exists (M9, not yet chosen), and
  that emailing the site is the only current way data reaches anyone.
- `components/Footer.tsx` — exports `TRADEMARK_DISCLAIMER` (the one sentence
  from spec §7, reused verbatim on `/about`) plus a nav row linking all six
  new pages. Rendered from `app/layout.tsx` (wrapped children in a flex
  column so the footer sits at the bottom on short pages) so it's present on
  every route without each page needing to import it.
- Per-figure provenance (spec §8): `lib/format.ts` gained `formatRetrievedAt`
  (manual UTC formatting, not `toLocaleString` — deterministic regardless of
  build/render locale). `PayrollChart.tsx`'s segment `<title>`, `aria-label`,
  and the sighted-user `ActiveSegmentReadout` all now include a derivation
  phrase (`"sourced from basketball-reference"` / `"estimated — see
  methodology"` / etc., one shared `derivationPhrase()` helper so the three
  can't describe derivation differently from each other) and the retrieval
  timestamp. `PayrollTable.tsx` gained `Source` (a real link to `sourceUrl`)
  and `Retrieved` columns. Threshold lines (cap/tax/apron) deliberately did
  *not* get provenance tooltips — `SeasonThresholds` carries no
  `sourceId`/`retrievedAt` fields at all (they're hardcoded from the NBA's own
  announcements, not per-value tracked), and inventing a source URL for them
  would have meant fabricating provenance metadata rather than disclosing a
  real gap — `/sources` states this limitation in prose instead.
- "Last updated" (spec §8): `lib/data/teamPayroll.ts` gained
  `lastUpdatedFor()` (pure — max `retrievedAt` across a team's own
  `capCharges`, ISO 8601 strings compare correctly as plain strings). Rendered
  on both `/team/[slug]` and `/team/[slug]/[season]`, linking to
  `/methodology` and `/sources`.
- `e2e/a11y.spec.ts` — added a `STATIC_PAGES` list (the six new routes, one
  axe pass each, no table-view loop since they have no chart) alongside the
  existing `ROUTES` array.

### A real tool problem hit and worked around
The Edit tool repeatedly rejected an old_string/new_string pair for
`PayrollChart.tsx`'s `ActiveSegmentReadout` function that, by every visual
inspection (including a fresh `Read` immediately before each retry), looked
identical to the file's actual content. Bisected with `xxd`/`od -c`: the
file's fallback `' '` (rendered when nothing is hovered/focused/pinned) is a
**non-breaking space (U+00A0, `c2 a0`)**, not a regular space (`0x20`) —
invisible in every rendered view (Read tool output, terminal, screenshots) but
a byte-for-byte mismatch against a normal space typed fresh. Worked around by
editing that one file via a small inline Python script operating on the raw
file bytes instead of the Edit tool for that specific change. Left the
non-breaking space itself alone (didn't "fix" it to a regular space) since
it's pre-existing M5 content unrelated to this session's task and changing it
wasn't asked for.

### Verified
- `npx tsc --noEmit` clean.
- `npm test` — 42/42 Vitest tests pass, unchanged (no pure-function logic
  touched this session).
- `npm run verify` — unchanged, all 30 teams reconcile across all their
  seasons.
- `npm run build` — production build succeeds; all six new pages statically
  generated (confirmed in the route table output) alongside the existing
  routes.
- `npm run a11y` — **12/12 pass, 0 violations**, up from 6/6 pre-session (the
  six new static pages added as one axe pass each).
- Manual browser verification (claude-in-chrome) on a fresh `next dev`
  instance (port 3100, separate from the a11y suite's own server): `/team/okc`
  shows "Data last updated 2026-07-26 01:46 UTC" sourced from the data file;
  hovering a segment shows `"Jalen Williams — $41,500,000 (2026-27) · sourced
  from basketball-reference · retrieved 2026-07-26 01:46 UTC"` in the readout;
  the table view's new Source/Retrieved columns render correctly with working
  links and no layout breakage from the total row's widened `colSpan`; the
  footer (disclaimer + six nav links) renders at the bottom of the page;
  `/methodology`'s live-computed stats sentence rendered correctly (1,033
  charges, 647 sourced, 386 estimated, across 30 teams); `/corrections`'
  `mailto:` link resolves to a correctly pre-filled template addressed to
  `tronjopvp@gmail.com`.

### Known gaps (carried forward / newly surfaced)
- Threshold-line figures (`SeasonThresholds`) still have no per-value
  `sourceId`/`retrievedAt` in the schema — disclosed in `/sources`, not fixed,
  since fixing it for real would mean sourcing an actual citation URL for the
  NBA's cap/tax/apron announcements, which wasn't done in any prior session
  either.
- The chart still doesn't visually distinguish `estimated` from `sourced`
  segments (M4/M5/M6's carried-forward gap) — `/methodology` now says this
  explicitly rather than letting the page imply otherwise, but the chart
  itself is unchanged.
- `/corrections` has no working submission form, only a `mailto:` link — a
  deliberate scope decision (no backend on a statically-exported site), not
  an oversight; worth revisiting if M9 ever adds server-side infrastructure
  for something else.
- `/about` doesn't name a real person, since none was provided or asked for
  beyond the contact email — revisit if the maintainer wants to be named.
- OG images, social sharing, SEO metadata (M8) and deployment/scheduled
  ingestion/analytics/hosting (M9) remain untouched, as instructed.

## M8 — Sharing and SEO (2026-07-26)

Built spec §10 in full: build-time OG images, download-PNG, per-route
metadata/canonical/structured data, sitemap/robots, and a 390px LCP check. No
deployment/scheduled-ingestion/monitoring work (M9) touched.

### OG image approach — decided with the user before writing code
Presented two options and the tradeoffs; user picked **next/og (Satori)** over
a Playwright headless-browser screenshot pipeline. Reasoning confirmed
correct during the session: Satori runs inside `next build` itself via the
`opengraph-image.tsx` file convention (no server to boot, no browser to
launch), is the documented pattern under `output: 'export'` (still unset in
`next.config.mjs` — unchanged M4 gap, but this is now forward-compatible with
it rather than fighting it), and needed zero new dependencies — Next already
vendors a Noto Sans TTF at `node_modules/next/dist/compiled/@vercel/og/` as
`ImageResponse`'s zero-config default font. Real build-time cost measured:
all 60 OG images (30 teams × 2 routes, one season each today) add well under
10s to a ~37s total production build.

The one accepted tradeoff, stated up front: Satori can't run
`lib/chart/labels.ts`'s leader-line collision algorithm (no arbitrary SVG
paths), so the OG image is a deliberate simplification, not a screenshot of
`<PayrollChart>`. What it does NOT simplify: `lib/og/renderTeamChart.tsx`
calls the exact same pure functions the live chart does —
`buildStackOrder`/`stackSeason` (stack.ts), `buildYScale` (scales.ts),
`bandOverages` (thresholds.ts), `MECHANISM_COLORS` (colors.ts) — so stack
order, segment heights, colors, and apron-crossing decisions can never
diverge from the real chart's own math. Only the paint layer (Satori-safe
divs: color blocks instead of `<rect>`, no per-segment text, no leader
lines) differs.

### What's here
- `lib/site.ts` — `SITE_URL`/`SITE_NAME`/`SITE_HOST`, one constant
  (`NEXT_PUBLIC_SITE_URL`-overridable) used everywhere a domain is needed.
  No real domain is registered yet (DATA-SOURCING.md, M7's `<site-domain-tbd>`
  precedent) — user chose a placeholder (`nba-payroll-explorer.example`) over
  supplying a real one now; swap it in this one file when a domain exists.
- `lib/og/renderTeamChart.tsx` — the Satori JSX renderer described above.
  Threshold labels get their own small, fixed-size collision-avoidance pass
  (sort by pixel y, push apart to a 26px minimum gap, draw a short tick from
  the true line to a shifted label) — found necessary the hard way: cap/tax/
  apron1/apron2 are frequently within a few percent of each other (spec §2's
  own numbers span barely $22M across three of the four lines on a ~$240M
  axis), so unadjusted labels overlapped into unreadable text on the first
  real render (OKC, Memphis both hit this immediately, not an edge case).
  This is a ~15-line fixed-size version of the same idea `labels.ts` solves
  generally for player segments — not a call to reuse `labels.ts` itself,
  which is built around `SegmentGeometry`/DOM callouts that don't apply here.
- `app/team/[slug]/opengraph-image.tsx` / `app/team/[slug]/[season]/opengraph-image.tsx`
  — `generateStaticParams` (the latter via the new `listTeamSeasonPairs`
  helper below), 1200×630, `contentType: 'image/png'`. The hub route renders
  every available season (today: just the one); the season route restricts
  to that single season — same restriction pattern `PayrollChart`'s own
  `seasons` prop already uses elsewhere.
- `lib/data/teams.ts` gained `listTeamSeasonPairs()` — the same
  load-every-team-and-intersect-available-seasons loop that
  `/team/[slug]/[season]/page.tsx`'s `generateStaticParams` already had
  inline, now shared by that route, its OG image route, and `sitemap.ts`
  (three consumers, one implementation). The page's own
  `generateStaticParams` was refactored to call it — same behavior, verified
  by the unchanged 60/60 static-page count in the build output.
- `lib/seo/teamSummary.ts` — `summarizeTeamSeason()`: a team's real apron/tax
  status for one season (default toggles — cap basis, holds included,
  absolute dollars — the same default a fresh page load renders, not any
  particular shared link's toggle state, since metadata is generated once
  per route at build time). Feeds both `generateMetadata`'s description and
  the OG image's headline from the same computation, so the two can't
  describe a team's situation differently from each other.
- `components/TeamStructuredData.tsx` — `SportsTeam` JSON-LD (spec §10 item
  5). Deliberately minimal: `name`/`sport`/`url` only — no `logo`/`image`
  (CLAUDE.md) and no `memberOf` league entity, since asserting a formal
  schema.org relationship to the NBA isn't this independent, unaffiliated
  project's to claim (Footer.tsx's own disclaimer). Rendered on both
  `/team/[slug]` and `/team/[slug]/[season]`.
- `app/team/[slug]/page.tsx` / `app/team/[slug]/[season]/page.tsx` —
  `generateMetadata` now returns a real per-team description
  (`summarizeTeamSeason`), `openGraph`/`twitter` objects, and a canonical
  URL. **Canonical decision**: `/team/[slug]` is always self-canonical (it's
  the evergreen hub). `/team/[slug]/[season]` canonicalizes to the hub
  *only* when that team has exactly one available season and it's the one
  in the URL — today, every team, so every season page currently
  canonicalizes back to its hub, since the two render byte-identical
  content. Computed from live `availableSeasonsFor()`, not hardcoded, so it
  flips to self-canonical automatically the moment a team spans more than
  one season (a genuinely different range vs. single-slice view at that
  point) — verified live via curl against both an un-seasoned and seasoned
  OKC URL.
- **A real Next.js quirk hit and worked around**: a route's own `twitter`
  metadata object doesn't deep-merge with the root layout's — returning
  `twitter: { title, description }` from `generateMetadata` silently
  dropped the layout's `card: 'summary_large_image'`, rendering as
  Next's `summary` default. Fixed by repeating `card` explicitly per route,
  which *also* wasn't sufficient alone — `images` had to be set explicitly
  too before the rendered `<meta name="twitter:card">` actually flipped to
  `summary_large_image` (confirmed by curling the rendered `<head>` before
  and after, not assumed from reading Next's source, which suggested the
  fix should have worked from `card` alone).
- `app/sitemap.ts` / `app/robots.ts` — Next's file-convention
  `MetadataRoute.Sitemap`/`Robots`, covering `/` + the six M7 static pages +
  all 30 `/team/[slug]` + all `/team/[slug]/[season]` pairs, with
  `lastModified` sourced from each team's own `lastUpdatedFor()` (never
  build time, same principle as the team pages' own "last updated" line).
  `/compare` and `/player` correctly absent — they don't exist yet.
- **Download PNG** (`components/chart/PayrollChart.tsx`): a new button next
  to "View as table", visible only in chart view. Serializes the *live*
  `<svg>` (via a new `svgRef`, not a second render), injects a `<style>`
  forcing monospace text (a standalone serialized SVG has no access to the
  page's Tailwind stylesheet, so `font-mono` on the root `<svg>` silently
  fell back to serif until this was added), appends a watermark `<text>`
  (`SITE_HOST`) in the bottom-right corner, then rasterizes through an
  offscreen `<canvas>` at 2x scale and triggers a download. Verified for
  real: clicked it in a running browser with several toggles + a pin active
  and confirmed the downloaded PNG matches exactly what was on screen
  (correct toggle state, the pinned player's highlight/outline, dimmed
  others, monospace numerals, watermark) — not just that a file appeared.
- `app/layout.tsx` — `metadataBase: new URL(SITE_URL)` (required for
  relative OG/canonical URLs to resolve absolutely) plus default
  `openGraph`/`twitter` objects for routes that don't set their own.

### Deep-linkable state — re-verified per this session's instructions
Loaded `/team/okc?basis=tax&holds=exclude&dollars=percent&guarantee=guaranteed&pin=gilgesh01`
fresh (no prior interaction) and confirmed every toggle control, the pin
highlight, and the info readout all reflect the URL on first paint — this
exercises `TeamPageClient`'s `useSearchParams` initial-read path, not just
`router.replace` after a click, which is the part a shared link actually
depends on. Nothing needed fixing; M5's URL-ownership design already handled
this correctly, this session just confirmed it under the added OG-image/SEO
surface rather than assuming it still held.

### 390px LCP check (spec §10 item 8)
No Lighthouse in this environment (not a project dependency, and this
machine has no reliable network-independent way to fetch it) — used
Playwright (already pinned in the project) directly instead: a real
Chromium context at exactly 390×844, CDP `Network.emulateNetworkConditions`
+ `Emulation.setCPUThrottlingRate` approximating Lighthouse's default mobile
profile (150ms RTT, ~1.6Mbps down, 4x CPU slowdown), against a real
production build (`next build` + `next start`), measuring actual
`PerformanceObserver` LCP entries rather than guessing from bundle size.

**Result: 468–600ms LCP** across `/`, `/team/okc`, `/team/mem` (heaviest
real roster at 21 charges in 2026-27), and `/team/mem/2026-27` — comfortably
under the 2.5s budget, no throttling profile came close to threatening it.
In every case the LCP element was ordinary server-rendered text (a `<p>`,
never the chart's `<svg>` or its `animate-pulse` skeleton) — confirming the
chart itself isn't on the LCP critical path, since it's client-hydrated and
paints after the text above/around it. **No lazy-loading or a lighter
mobile variant is needed.** Worth re-running this check if a future session
adds heavier above-the-fold content (M9's analytics snippet, additional
seasons inflating the chart's own JS bundle materially) rather than assuming
this result holds forever.

### Verified
- `npx tsc --noEmit` clean.
- `npm test` — 42/42 Vitest tests pass, unchanged.
- `npm run verify` — 131 OK / 0 FAIL, unchanged.
- `npm run build` — production build succeeds; 60 OG images (30 teams × hub
  + season route) generate alongside the existing 132 routes; `sitemap.xml`/
  `robots.txt` present in the route table.
- `npm run a11y` — **12/12 pass, 0 violations**, unchanged (the new Download
  PNG button is a native `<button>`, no new a11y surface).
- Manual browser verification (claude-in-chrome + direct curl/file fetches,
  bypassing browser cache after hitting a stale-server false alarm mid-session
  — see below): OG images for OKC and Memphis render correctly (real bars,
  real colors, correct threshold labels with no overlap after the fix above,
  correct over-threshold shading matching each team's real apron status,
  correct headline text, watermark present); `/team/okc`'s rendered `<head>`
  has the right title/description/canonical/og:*/twitter:*/JSON-LD; `/team/okc/2026-27`
  correctly self-canonicalizes to `/team/okc`; `sitemap.xml` and `robots.txt`
  serve real XML/text with the placeholder domain; the deep-link and
  download-PNG checks described above.
- **A process-management false alarm, worth remembering**: mid-session, a
  label-collision fix appeared to have no effect after rebuilding — the
  running `next start` server had actually failed to restart (`EADDRINUSE`,
  logged but not surfaced since it ran via `nohup ... &`) and a stale
  process from before the fix was silently still serving on the same port.
  Diagnosed via `lsof -iTCP:4174` and the ignored start-log, not assumed.
  Killing the actual PID (not `pkill -f "next start"`, which didn't match
  it) resolved it. Not an app bug — a reminder that "the build succeeded"
  doesn't guarantee "the server you're curling is running that build."

### Known gaps (carried forward / newly surfaced)
- OG images use each route's *default* toggle state (cap basis, holds
  included, absolute dollars) regardless of what a shared link's own query
  string requests — a scope decision, not an oversight: generating a
  distinct static image per toggle combination isn't feasible at build time,
  and spec §10 item 1 asks for "per team and season," not per toggle state.
  Worth a line on `/methodology` if a user ever asks why a heavily-toggled
  shared link's preview doesn't match its own chart.
- OG images still don't visually distinguish `estimated` from `sourced`
  segments — same carried-forward gap as the live chart (M4–M7), unchanged
  by this session since it wasn't in scope to fix generally, only to not
  regress.
- Threshold reference lines in the OG image use only the most recent
  rendered season's cap/tax/apron figures even when multiple seasons render
  (today: moot, every team has exactly one available season) — flagged in
  `renderTeamChart.tsx`'s own comment for whoever next extends
  `data/thresholds.ts` past two seasons.
- `next.config.mjs` still has no `output: 'export'` (M4's original gap) —
  this session deliberately chose an OG-image approach that's forward-
  compatible with turning it on, but didn't turn it on itself, since that's
  M9's static-export-behind-a-CDN decision, not this session's.
- No dedicated `twitter-image.tsx` file convention was added — Next's own
  file-convention resolution reuses `opengraph-image.tsx` for Twitter cards
  when no separate one exists, which is correct here since both platforms
  should show the identical graphic; noted only so a future session doesn't
  wonder why one is missing.

## M9 — Automation and launch (2026-07-26)

Built spec §11's final milestone: scheduled ingestion with failure/staleness
alerting, static export turned on, Sentry + Plausible wired in, CDN security
headers, a real Vercel deployment, and a load-test sanity check. This is also
the session that gave the project version control and a GitHub remote for the
first time — there was no `.git` directory at all before this session.

### Decisions made with the user before writing any code
Four real infrastructure choices the spec deliberately left open, asked via
`AskUserQuestion` rather than assumed: **git init + create a new GitHub repo
now** (needed for the Action to actually run, not just exist as YAML);
**Vercel** over Netlify/Cloudflare Pages for the CDN host; **Sentry wired
with a placeholder `NEXT_PUBLIC_SENTRY_DSN`** (no-ops until the user creates
a project and sets it) rather than blocking on a real DSN; **Plausible
Cloud** over self-hosted Umami. Repo name/visibility (`nba-payroll-explorer`,
public) was a fifth quick confirmation — public was the user's own call,
reasoning that the site itself is already public and nothing secret is
tracked.

### What's here
- `next.config.mjs` — `output: 'export'` finally turned on (M4's
  long-carried gap). Needed two follow-on fixes to actually build:
  `app/sitemap.ts` and `app/robots.ts` both needed `export const dynamic =
  'force-static'` — Next's static-export check can't otherwise confirm a
  file-convention route handler has no request-time dependency, even though
  both were already pure/fs-only. Verified no other server-only feature
  existed to conflict (`grep`ped for `next/image`, `route.ts`,
  `middleware.ts`, `next/headers`, `dynamic = ...`, `revalidate` — none
  found). Full rebuild produces a genuine static `out/` directory: 68 HTML
  files, 60 binary OG-image files, `sitemap.xml`/`robots.txt` as plain
  files — confirmed by listing the directory, not just trusting the build
  log.
- `.github/workflows/ingest.yml` — daily (`37 8 * * *`, deliberately off
  the hour) `orchestrate.ts` run, gated by `verify.ts`, committing the
  `data/` diff only if both succeed. Did **not** need to add any new
  failure-detection logic: `scripts/orchestrate.ts` (M3 follow-up) already
  exits non-zero on an `AbortRunError` (429/403) or any per-team parse/fetch
  failure, and `scripts/verify.ts` already exits non-zero on a
  reconciliation mismatch — so a failing step just fails the job, and
  GitHub's own failed-workflow email is the alert, per the user's explicit
  "don't over-build this."
- `.github/workflows/staleness-check.yml` + `scripts/checkStaleness.ts` —
  deliberately separate from the ingestion job (per spec §8: this exists to
  catch the ingestion Action *silently no longer running*, which wouldn't
  otherwise produce any failure). Runs every 6 hours, reads the same
  `data/teams/*.json` files the site itself reads via the existing
  `lastUpdatedFor()` helper (not git commit history — consistent with the
  "last updated" timestamp on team pages already being sourced from the data
  file, not build/commit time), and fails if the freshest `retrievedAt`
  across all 30 teams is more than 72 hours old.
- `vercel.json` — CSP, HSTS (`max-age=63072000; includeSubDomains`, no
  `preload` yet since no real domain exists to submit), and
  `X-Content-Type-Options: nosniff`, applied at the edge for every route.
  Has to live here rather than in `next.config.js`'s `headers()` function
  because that function isn't supported under `output: 'export'` — confirmed
  by design, not by hitting the error, since the spec's CDN-edge framing
  already pointed here.
- `lib/sentry.ts` + `components/SentryInit.tsx` — `@sentry/react` (not
  `@sentry/nextjs`): a plain static export has no server for `@sentry/nextjs`'s
  server/edge instrumentation to attach to, and the spec explicitly asks for
  client-side only, so the simpler browser SDK avoids fighting a Next.js
  server-runtime plugin for zero benefit. Reads
  `NEXT_PUBLIC_SENTRY_DSN` (must be `NEXT_PUBLIC_` — static export bakes env
  vars in at build time), no-ops cleanly when unset, `sendDefaultPii: false`,
  `tracesSampleRate: 0` (errors only, nothing fancier than what spec §4/§11
  asked for).
- `app/layout.tsx` — a `next/script` tag for Plausible
  (`data-domain={SITE_HOST}`, `strategy="afterInteractive"`), cookie-free per
  spec §4. Silently records nothing useful until `SITE_HOST` is a real
  registered domain — same "wire it now, activate later" pattern as Sentry.
- `app/privacy/page.tsx`, `app/corrections/page.tsx` — rewritten to honestly
  reflect Plausible/Sentry now existing, replacing the earlier M7 "no
  analytics or tracking" language. This was the actual moment those earlier
  pages' own stated principle ("rewritten when it changes, not patched with
  boilerplate written in advance") applied for real, not a hypothetical.
  `/corrections`' "why email-only" reasoning was also corrected in passing —
  it was never really about analytics, it's about there being no backend on
  a static export to receive a form submission.

### Git/GitHub/Vercel setup — real friction, worth recording
- `gh` CLI wasn't installed; `brew install gh` worked cleanly in the
  background (unlike Node in M1, no from-source compile needed).
- `gh auth login`'s device-code flow doesn't work well backgrounded through
  this tool: a first attempt got auto-backgrounded by the 120s timeout, and
  the user completing a *different* `gh auth login` invocation elsewhere on
  the same machine created an unrelated second device code rather than
  satisfying the first — gh auth is per-invocation, not a global "is anyone
  logged in" race. Resolved by killing both stale processes and having the
  user run `gh auth login` themselves via this session's `!`-prefixed
  passthrough, which puts the login in the same environment this tool
  operates in.
- `.claude/settings.local.json` (machine-specific absolute paths, local
  Claude Code permission settings) was caught before the first commit and
  added to `.gitignore` — it isn't secret, but it isn't repo content either.
- First push was rejected: `refusing to allow a Personal Access Token to
  create or update workflow .github/workflows/ingest.yml without workflow
  scope`. `gh auth login`'s default scopes don't include `workflow`; fixed
  with `gh auth refresh -s workflow` (its own device-code flow, same
  in-session pattern). That alone wasn't sufficient — git's credential
  helper for github.com was `osxkeychain`, caching the pre-refresh token, so
  the push still failed identically until `gh auth setup-git` installed
  `!gh auth git-credential` as the host-specific helper, which always reads
  gh's current token rather than a cached one.
- `vercel link` failed once on project naming: it derives a default name
  from the directory (`NBA Payrolls`), which has a space and uppercase
  letters and Vercel's project-name rules reject — fixed by passing
  `--project nba-payroll-explorer` explicitly. It also couldn't
  auto-connect the GitHub repo ("Failed to connect... Make sure you have
  access") — that specific link needs the Vercel GitHub App authorized via
  their web UI, not something the CLI can complete non-interactively. Left
  unconnected for now: `vercel deploy` still works standalone and was used
  for this session's actual deployment; connecting the repo for
  automatic per-push deploys is a real follow-up, not done this session.
- Both `gh` and `vercel` needed a genuine human-completed browser device-code
  step; this session could detect what was needed and prepare everything
  around it, but could not complete either login itself.

### Live end-to-end verification, not just YAML review
Rather than trust that the workflow files were merely syntactically valid,
manually triggered both via `gh workflow run` and watched them run for real
in GitHub's own runners (confirmed with the user first for the ingestion one
specifically, since it makes real live requests against Basketball-Reference
and pushes a real commit — the staleness check has no external side effects
so didn't need to ask):
- **Staleness check**: ran in ~31s, correctly read all 30 teams' data,
  computed "15.0h ago", passed.
- **Scheduled ingestion**: ran for real — fetched all 30 teams live from
  Basketball-Reference (3s crawl-delay honored between requests, same as
  every prior session's local runs), every season across all 30 teams
  reconciled via `verify.ts`, detected a genuine diff (fresh `retrievedAt`
  timestamps), committed as `github-actions[bot]`, and pushed —
  `55c16c7..6cc7f3e`, 30 files changed. Pulled that commit back down locally
  afterward to stay in sync. This is the single most convincing check in
  this session: the automation doesn't just look right, it already worked,
  once, for real, on GitHub's own infrastructure.

### The load-test: a real finding, not a clean pass
Deployed to Vercel (`vercel link --project nba-payroll-explorer` then
`vercel deploy`; first deployment auto-promotes to production, aliased at
`https://nba-payroll-explorer.vercel.app`). Confirmed correct before load
testing at all: `/`, `/team/okc`, `/sitemap.xml`, `/robots.txt`,
`/methodology`, and an OG image all returned 200, and `curl -I` confirmed
CSP/HSTS/`X-Content-Type-Options` all present exactly as configured in
`vercel.json`.

First `autocannon -c 100 -d 20` run against the live URL produced 1,109
non-2xx responses and 114 timeouts out of ~1,223 requests — but the
non-2xx bodies were Vercel's own **"Vercel Security Checkpoint"** page
(confirmed by reading the actual response body, not assumed from the status
code alone), not an app error. This is Vercel's automatic system-level DDoS
mitigation, which exists on the Hobby tier with no configurable bypass —
confirmed directly via `vercel firewall overview` returning `"IP Bypass is
unavailable for this plan (404)"`. A second, much gentler retry
(`-c 10 -d 10`, after waiting for the block to clear) tripped the same
protection again almost immediately (1,210 of ~1,247 requests non-2xx),
and a single ordinary `curl` afterward also came back 403 — confirming this
project's Hobby-tier plan cannot be meaningfully load-tested by hammering
the live production URL from one source IP, at any concurrency, full stop.
This is a real constraint of the hosting tier, not a bug to fix.

**Pivoted to testing the actual static-export artifact directly**: served
`out/` locally via `serve` and ran `autocannon` against `localhost` instead,
where there's no third-party WAF in the way. `-c 100 -d 15` against `/`:
4,000 requests in 15.29s, **zero errors, zero non-2xx**. `-c 100 -d 10`
against `/team/mem` (heaviest real roster, 21 charges, per M8's LCP check):
~3,000 requests, zero errors. `-c 200 -d 10` against `/`: throughput held
around 310-320 req/s with latency degrading gracefully (median 739ms) under
double the concurrency — still zero errors. This is the right signal for
what spec §11 actually asked ("confirm the static export actually serves
correctly under concurrent load"): the exported artifact is pure file I/O
with no per-request server compute, which is exactly what makes it
trivially horizontally scalable behind a real multi-region CDN edge — a
real traffic spike is many *different* visitor IPs, nothing like the
single-IP burst that tripped Vercel's abuse detection, so it wouldn't
trigger the same mitigation in production. The takeaway for whoever reads
this later: don't repeat the naive "autocannon the production URL" approach
on Hobby tier; test the exported artifact directly, or upgrade to a plan
with IP-bypass support first.

### Final CLAUDE.md compliance pass (per the user's explicit request)
Re-read every rule in CLAUDE.md's `## Rules` and `## Don't` sections against
the actual current codebase (grepped and read the real files — did not rely
on trusting each milestone's own "Verified" section). Most rules hold up:
no `.append()` calls anywhere (D3/React boundary respected), no charting
library in `package.json`, every real and synthetic `CapCharge` carries
integer `capHit`/`taxHit`/`apronHit` and all four provenance fields
(spot-checked all 30 real team files programmatically, not just OKC),
two-way contracts are genuinely never emitted, `cheerio`/BR-specific parsing
never leaks outside `scripts/ingest/basketball-reference/`, no live-scraping
API route exists, no team/league logos or player photos anywhere. **Four
real findings, all pre-existing and now confirmed rather than newly
introduced:**

1. **"Estimated values are visually distinct from sourced ones. No
   exceptions" is violated in the chart itself.** Confirmed by reading
   `PayrollChart.tsx`: `derivation` is used only in `aria-label`/`title`/the
   sighted-user text readout — never in fill, opacity, or a pattern.
   Flagged as a known gap in M4, M5, M6, and M7's own notes and never
   fixed; M6's table view gives it a text channel, but the rule says "no
   exceptions" and the chart itself is still one. This matters more today
   than when first flagged: `/methodology`'s own live-computed stat says
   386 of the real dataset's charges are currently `'estimated'`, all
   rendering with full visual confidence.
2. **"Projected thresholds render dashed" is unimplemented at the line
   level.** `isProjected` only changes threshold label text
   ("(projected)"/"(proj.)"); `strokeDasharray` is keyed by threshold
   *type* (cap/tax/apron1/apron2), never by projected status. Dormant today
   — `data/thresholds.ts` has no `isProjected: true` rows yet — but it's a
   silent time bomb: the moment a future session adds a projected out-year
   threshold, it will render exactly as solid and confident as a real one,
   which is precisely what this CLAUDE.md rule and spec §2 exist to
   prevent. Whoever extends `data/thresholds.ts` next should fix this
   first, not after.
3. **CLAUDE.md's own text is stale versus shipped, user-approved
   behavior.** "Apron thresholds are compared against apronHit only" no
   longer describes the code: M5's basis toggle (confirmed by reading
   `lib/chart/toggles.ts`'s `selectAmount`) makes *all* threshold
   comparisons use whichever of `capHit`/`taxHit`/`apronHit` is currently
   selected, not `apronHit` unconditionally. This was a deliberate,
   user-confirmed decision in M5 and is honestly described in
   `/methodology` (M7 explicitly flagged the CLAUDE.md/code mismatch at the
   time) — but CLAUDE.md's rule text itself was never updated to match, so
   it will mislead any future session that trusts CLAUDE.md over the code.
   Worth a one-line edit to CLAUDE.md itself, not just the methodology page.
4. **"Don't encode meaning by color alone" is only fully satisfied with the
   table view open.** Player identity is fine (paired with direct labels
   regardless of color). A segment's contract *mechanism/tier* has no
   non-color channel inside the chart itself — no hatch/pattern was ever
   built (spec's own suggested alternative). M6 explicitly scoped this as a
   judgment call (the table's `Mechanism` column is the real remedy) rather
   than silently leaving it — recorded here as still open, not resolved.

Two adjacent, non-rule items worth knowing about before calling this
launch-ready: **no favicon exists at all** (not a rule violation — CLAUDE.md
only bans NBA/team logos as favicons — but a real polish gap for a public
launch); and **the CSP genuinely needs `script-src`/`style-src
'unsafe-inline'`** (confirmed necessary: the built HTML has 7 inline
`self.__next_f.push(...)` hydration scripts and one repeated inline `style=`
attribute, and static export has no server to inject a per-request nonce).
This is a real, disclosed weakening of CSP's XSS protection inherent to this
hosting model — not a mistake, but not free either.

### Verified
- `npx tsc --noEmit` clean.
- `npm test` — 42/42 Vitest tests pass, unchanged.
- `npm run verify` — all 30 teams + the synthetic fixture reconcile,
  unchanged in count, re-run after the live ingestion Action's real commit
  landed locally too.
- `npm run build` — now a genuine static export (confirmed via `out/`
  directory contents, not just a clean exit code).
- `npm run a11y` — **12/12 pass, 0 violations**, re-run twice this session
  (once after `output: 'export'`, once after the Plausible/privacy-page
  changes) to confirm neither regressed anything.
- Both GitHub Actions triggered manually and watched to real completion
  (see above) — not just YAML-validated.
- Live production deployment spot-checked route-by-route before load
  testing; security headers confirmed present via `curl -I` against the
  real edge, not just read from `vercel.json`.
- Local static-export load test: zero errors across ~10,000 combined
  requests at 100-200 concurrent connections against three different
  routes.

### Known gaps (final, whole-project list — carried forward, not fixed this session)
- The four CLAUDE.md compliance findings above (estimated/sourced visual
  distinction, projected-threshold dashing, the apronHit rule-text/code
  mismatch, in-chart color-alone for mechanism) are all real and still
  open. None are new; all predate this session and were reasoned-through
  judgment calls or scope decisions at the time, not oversights — but
  "flagged before" isn't the same as "fixed," and the user asked
  specifically to know before this goes public.
- No favicon.
- Vercel GitHub App isn't connected — `vercel deploy` from the CLI is the
  only deploy path today; pushing to `main` does not auto-deploy. Connecting
  it (via Vercel's dashboard, not the CLI) is a real, easy follow-up.
- Vercel Hobby tier's automatic DDoS mitigation has no IP-bypass — worth
  knowing before anyone tries to load-test the live URL again the naive way.
- `NEXT_PUBLIC_SENTRY_DSN` and Plausible's site registration are both still
  unset/unconfigured on the real Vercel project (no env vars exist there
  yet, confirmed via `vercel env ls`) — both are wired to activate
  automatically the moment the user sets them up, no code change needed.
- `SITE_URL` is still the `nba-payroll-explorer.example` placeholder (M7/M8
  gap, unchanged) — no real domain has been registered. Sitemap, canonical
  tags, and JSON-LD are all correct *relative to* that placeholder today.
- Vercel's HSTS header intentionally omits `preload` until a real domain
  exists to actually submit to the browser preload list.
- No commercial data licensing (Spotrac) was ever pursued — unchanged from
  every prior session; the derive-from-primitives architecture (§3 option 3)
  has been the actual, working approach since M3.
- Cap holds, draft-rights holds, and incomplete-roster charges are still
  unsourced for every team (M3's original gap, confirmed still true — no
  session between M3 and M9 added a second source for these charge types).
- `optionDecided` is still always conservatively `false` (M3's original
  simplification, unchanged).

## Project summary (M0–M9, end to end)

A from-scratch public NBA payroll visualization site, built session by
session per the spec's milestone split, now deployed for real at
`https://nba-payroll-explorer.vercel.app` (placeholder domain in the code;
no custom domain registered yet) with a working daily data-refresh pipeline.

**The data**: real contract primitives for all 30 teams, scraped from
Basketball-Reference's contracts pages under a documented, robots.txt-honoring,
crawl-delay-respecting adapter (M3), refreshed daily by a scheduled GitHub
Action (M9) that only commits when every team's numbers reconcile against
BR's own reported totals. Every cap/tax/apron/dead-money/hold figure is
*derived* by this project's own CBA rules engine (`lib/cba/`) from sourced
contract terms, not copied from any site's own computed numbers — the
architecture decision made in M0/DATA-SOURCING.md and never revisited,
because it worked. Every single charge, real or synthetic, carries full
provenance (`sourceId`, `sourceUrl`, `retrievedAt`, `derivation`) with no
exceptions found in an audit of all 30 teams. Known, disclosed real-world
gaps: cap holds/draft holds/incomplete-roster charges have no source yet;
option-exercise decisions are always conservatively "undecided"; ~386
charges are `'estimated'` rather than `'sourced'` due to a genuine BR
table limitation (multiple non-guaranteed seasons sharing one aggregate
guarantee figure) — all correctly reconciled in total dollars regardless.

**The chart**: hand-authored SVG (M1), no charting library, D3 for geometry
only. Fixed stack order across seasons (sorted by focus-season `capHit`),
inside labels with an outside-callout-plus-leader-line fallback and a
pool-adjacent-violators collision resolver for dense clusters (a genuine bug
found and fixed in M2 — the original bidirectional sweep's backward pass was
provably dead code), an "Others (n)" collapse past 8 callouts, six-category
contract-mechanism coloring on a single validated hue ramp (never one color
per player), and over-threshold shading that intensifies at tax/apron1/apron2.
Real interactions on top (M5): hover/click-to-pin/keyboard nav, four toggles
(cap/tax/apron basis, dead-money-and-holds inclusion, absolute-vs-percent
dollars, guaranteed-only), all URL-owned so every view is a shareable link.
A parallel league-wide view (`/`) reuses the same stacking/threshold math
horizontally across all 30 teams. A visible chart/table toggle (M6) gives
every chart a full non-visual equivalent, and axe-core runs in CI
(`pnpm a11y`) — 12/12 routes currently pass 0 violations.

**The public surface** (M7): methodology, sources, glossary, corrections
(email-based — no backend exists to receive a form), about, and privacy
pages, a site-wide trademark disclaimer, per-figure provenance tooltips, and
"last updated" timestamps sourced from the data itself. **Sharing** (M8):
build-time OG images via Satori/`next/og` (a deliberate visual
simplification of the real chart, but built from the exact same stacking/
threshold/color functions so it can never disagree with the live chart),
a download-PNG button that serializes the live, currently-toggled SVG
(not a second render), sitemap/robots/canonical URLs/JSON-LD, and a
measured 468-600ms mobile LCP — comfortably under the 2.5s budget.

**Launch infrastructure** (M9, this session): the project's first `git`
history and a public GitHub repo
(`https://github.com/tloja/nba-payroll-explorer`); a daily-scheduled,
already-proven-working ingestion Action with a separate 72-hour staleness
alarm; a genuine static export (`output: 'export'`, verified as real static
files, not just a clean build); a live Vercel deployment with CSP/HSTS/
`X-Content-Type-Options` confirmed present at the edge; Sentry and Plausible
wired in (both currently inert, pending a real DSN and site registration —
by design, not oversight); and a load-test that ended up testing something
more useful than originally planned, once Vercel's own Hobby-tier DDoS
protection made the naive version of the test impossible.

**What a future session (or the user, before really launching) should still
do**: fix the four CLAUDE.md compliance findings above, especially the
estimated/sourced visual-distinction gap given it's now affecting 386 real
charges; register a real domain and update `SITE_URL`/the User-Agent contact
string/HSTS `preload`; create real Sentry and Plausible accounts and set
the two env vars on Vercel; connect the Vercel GitHub App for automatic
deploys-on-push; add a favicon; and consider whether Basketball-Reference's
missing cap-hold/draft-hold/incomplete-roster charge types matter enough for
any specific team to pursue a second source. None of these block the site
from being live and functionally correct today — they're the honest list of
what "done" doesn't yet mean.
