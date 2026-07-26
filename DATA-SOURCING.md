# Data Sourcing Decision
   
   Approach: derive-from-primitives (spec §3, option 3)
   - Contract primitives (per-season salary, guarantee structure, option type) sourced from:
     Basketball-Reference team contract pages (e.g. basketball-reference.com/contracts/OKC.html).
     Confirmed in the M3 session (2026-07-25) — the placeholder here was unfilled before that;
     the "Constraints" bullet below existed but had never been confirmed as an actual sourcing
     decision, just documentation of BR's terms in case it was used. Asked the user directly
     rather than assuming; answer was Basketball-Reference.
   - All cap/tax/apron hits computed via our own CBA rules engine (lib/cba/), not copied from
     any site. Note: BR's contract table already publishes the resolved per-season dollar
     figure (not a start-salary + raise% pair), so for standard contracts the engine's output
     will match BR's own numbers — the independence is in storing/deriving from the per-season
     schedule via our own engine rather than storing BR's own computed cap/tax/apron labels
     verbatim, and in the engine being what computes dead money, stretch schedules, and
     apron-vs-cap-vs-tax distinctions BR's page doesn't itself provide.
   - No commercial licensing pursued yet (Spotrac quote, etc.) — out of scope for this session,
     revisit before a launch that depends on data BR doesn't cover (cap holds, incomplete-roster
     charges — see below).
   - Known gap: BR's contract page is a signed-contracts table. It likely does not list cap
     holds, draft-rights holds, or incomplete-roster charges. The M3 adapter only emits
     standard/dead-money charges from that page; if a team's real books need those other
     charge types, they are not yet sourced from anywhere and verify.ts will flag the gap
     rather than a session guessing a number to fill it.
   
   Constraints for any future session:
   - No scraping Spotrac (ToS prohibits it)
   - Basketball-Reference: crawl-delay is read from robots.txt programmatically at runtime,
     not hardcoded — see scripts/ingest/basketball-reference/fetch.ts. Cache aggressively,
     never fetch live on request, sequential requests only, abort the whole run on 429/403.
   - No player photos, no team/league logos, anywhere
