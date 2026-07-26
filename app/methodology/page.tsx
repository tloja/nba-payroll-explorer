import Link from 'next/link';
import type { Metadata } from 'next';
import { computeDatasetStats } from '../../lib/data/stats';
import { formatRetrievedAt } from '../../lib/format';

export const metadata: Metadata = {
  title: 'Methodology — NBA Payroll Explorer',
  description: 'What counts in cap, tax, and apron payroll, how every figure is derived, and what is and isn’t sourced yet.',
};

export default function MethodologyPage() {
  const stats = computeDatasetStats();

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/" className="text-sm text-[#52514e] underline">
        &larr; Home
      </Link>
      <h1 className="mt-2 text-xl font-semibold">Methodology</h1>
      <p className="mt-2 text-sm leading-relaxed text-[#52514e]">
        This page describes exactly how the numbers on this site are calculated, not a general explanation of NBA
        salary rules. For definitions of individual terms (apron, Bird rights, stretch provision, etc.), see the{' '}
        <Link href="/glossary" className="underline">
          glossary
        </Link>
        . For where the underlying contract data comes from, see{' '}
        <Link href="/sources" className="underline">
          sources
        </Link>
        .
      </p>

      <h2 className="mt-8 text-lg font-semibold">1. Cap, tax, and apron payroll are three different numbers</h2>
      <p className="mt-2 text-sm leading-relaxed">
        Every charge on a team&apos;s books &mdash; every player contract, every dead-money charge, every hold &mdash;
        carries three dollar figures: a cap hit, a tax hit, and an apron hit. Today, for every real contract in this
        dataset, those three figures are identical &mdash; this site doesn&apos;t yet model incentives or other
        adjustments that would make them diverge. The &ldquo;Basis&rdquo; toggle on a team page lets you pick which
        of the three is being measured; whichever one you pick is compared against all four threshold lines (cap,
        tax, first apron, second apron) together, so the chart always answers one honest question &mdash;
        &ldquo;how does <em>this</em> payroll lens compare to these lines&rdquo; &mdash; rather than mixing lenses
        within a single view.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[#52514e]">
        Worth flagging: an earlier draft of this project&apos;s internal build notes described the intent as
        &ldquo;apron thresholds are always compared against apron payroll specifically.&rdquo; What&apos;s actually
        built is the toggle behavior above, which was a deliberate choice made partway through development so the
        whole chart stays internally consistent under every basis, not just apron. If the three figures ever
        diverge in real data, this is the rule that will govern what you see.
      </p>

      <h2 className="mt-8 text-lg font-semibold">2. What counts against team salary</h2>
      <p className="mt-2 text-sm leading-relaxed">Every stack on this site can include:</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
        <li><strong>Player contracts</strong> &mdash; standard signed deals.</li>
        <li><strong>Dead money</strong> &mdash; guaranteed money still owed to a player no longer on the roster (see below).</li>
        <li><strong>Cap holds</strong> &mdash; placeholder charges for a team&apos;s own free agents, relevant only when a team is planning around the cap.</li>
        <li><strong>Draft-rights holds</strong> &mdash; placeholder charges for an unsigned draft pick.</li>
        <li><strong>Incomplete-roster charges</strong> &mdash; a minimum-salary placeholder for each empty roster spot below 12.</li>
      </ul>
      <p className="mt-2 text-sm leading-relaxed">
        <strong>Two-way contracts do not count against team salary and never appear in a stack at all</strong> &mdash;
        not filtered out, simply never generated as a charge in the first place.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[#52514e]">
        Disclosed gap: cap holds, draft-rights holds, and incomplete-roster charges exist in this site&apos;s data
        model, but nothing currently supplies real numbers for any of the three &mdash; the source this site
        currently uses (see{' '}
        <Link href="/sources" className="underline">
          sources
        </Link>
        ) only publishes signed contracts. A team&apos;s total here can therefore be lower than a total that
        accounts for its free-agent holds or open roster spots. This hasn&apos;t affected reconciliation for any of
        the 30 teams currently on the site (see item 7), but it&apos;s a real, known incompleteness, not an oversight
        we&apos;re unaware of.
      </p>

      <h2 className="mt-8 text-lg font-semibold">3. How dead money is calculated</h2>
      <p className="mt-2 text-sm leading-relaxed">
        When a player is waived, the guaranteed money remaining on their contract still counts against the team.
        There are two cases:
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
        <li>
          <strong>Not stretched:</strong> each remaining guaranteed season counts on its original schedule &mdash;
          exactly as if the player were still on the books that year.
        </li>
        <li>
          <strong>Stretched:</strong> the CBA lets a team spread the total remaining guaranteed money evenly over{' '}
          <em>twice the number of remaining seasons, plus one</em>. A player with 2 years left who&apos;s stretched
          has that money spread over 5 seasons instead of 2 &mdash; which is how a 2024 waiver can still show up on a
          team&apos;s 2029 books. Any leftover cents from dividing evenly land on the final season, so the total
          across all spread seasons matches exactly.
        </li>
      </ul>

      <h2 className="mt-8 text-lg font-semibold">4. Guarantee status</h2>
      <p className="mt-2 text-sm leading-relaxed">
        Each charge is <strong>fully guaranteed</strong>, <strong>partially guaranteed</strong>, or{' '}
        <strong>not guaranteed</strong>. This site&apos;s source publishes one aggregate guaranteed-dollar figure for
        an entire remaining contract, not a season-by-season breakdown, so partial guarantees have to be worked out:
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
        <li>
          If exactly one remaining season on a contract is flagged as not fully guaranteed, this site works out its
          exact guaranteed dollar amount by subtracting the fully-guaranteed seasons&apos; total from the contract-wide
          aggregate. This is exact arithmetic, not an estimate.
        </li>
        <li>
          If two or more remaining seasons are flagged that way, the split genuinely can&apos;t be recovered from
          the source data &mdash; there&apos;s no way to know which season owns how much of the aggregate. In that
          case the whole contract is marked <strong>estimated</strong> (see item 6) rather than guessing a split.
        </li>
      </ul>

      <h2 className="mt-8 text-lg font-semibold">5. Option years</h2>
      <p className="mt-2 text-sm leading-relaxed">
        A contract season can carry a player option, a team option, or an early-termination option. This site&apos;s
        source publishes the option type but not always whether it&apos;s already been decided (exercised or
        declined) &mdash; that information lives in a part of the source page this site deliberately doesn&apos;t
        parse yet. As a result, <strong>every option-bearing season is currently treated as undecided</strong>, even
        in cases where the option has, in reality, already been exercised. This is a conservative simplification,
        not an error: an undecided option always downgrades that season to <strong>estimated</strong> rather than
        risk stating an outcome as fact before it&apos;s confirmed.
      </p>

      <h2 className="mt-8 text-lg font-semibold">6. What &ldquo;derivation&rdquo; means on this site</h2>
      <p className="mt-2 text-sm leading-relaxed">Every dollar figure on this site is labeled with one of four derivations:</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
        <li><strong>Sourced</strong> &mdash; the dollar figure is stated directly by the source for a season with no open option.</li>
        <li><strong>Computed</strong> &mdash; derived by this site&apos;s own rules engine from contract primitives, with none of the estimation triggers below.</li>
        <li><strong>Estimated</strong> &mdash; downgraded from sourced/computed because of an undecided option (item 5) or an unrecoverable multi-season guarantee split (item 4). Estimated figures are real numbers, not guesses at the dollar amount itself &mdash; what&apos;s uncertain is a status flag, not the salary.</li>
        <li><strong>Synthetic</strong> &mdash; placeholder data used only during early development, before any real contract data existed. Not present on any page of the live site today.</li>
      </ul>
      <p className="mt-2 text-sm leading-relaxed text-[#52514e]">
        As of the last data refresh ({stats.lastUpdatedAt ? formatRetrievedAt(stats.lastUpdatedAt) : 'not yet run'}),
        this dataset has {stats.chargeCount.toLocaleString('en-US')} charges across {stats.loadedTeamCount} teams:{' '}
        {stats.derivationCounts.sourced.toLocaleString('en-US')} sourced,{' '}
        {stats.derivationCounts.computed.toLocaleString('en-US')} computed, and{' '}
        {stats.derivationCounts.estimated.toLocaleString('en-US')} estimated
        {stats.estimatedTeamCount > 0 ? ` (affecting ${stats.estimatedTeamCount} teams)` : ''}. This count is computed
        live from the underlying data, not a fixed snapshot, so it will track forward as data is refreshed.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[#52514e]">
        Known display gap: the chart itself doesn&apos;t yet visually distinguish estimated segments from sourced
        ones &mdash; that distinction currently only appears in each team page&apos;s table view (the
        &ldquo;Derivation&rdquo; column) and in each segment&apos;s own tooltip/accessible label. We&apos;re stating
        this plainly rather than letting the chart imply a confidence it doesn&apos;t visually show yet.
      </p>

      <h2 className="mt-8 text-lg font-semibold">7. How totals are checked</h2>
      <p className="mt-2 text-sm leading-relaxed">
        For every team and season, this site adds up its own itemized charges and checks that sum against the
        source page&apos;s own reported team total for that season, to within $1. This check has passed exactly (to
        the dollar) for every team and season currently on the site.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[#52514e]">
        What this proves, and what it doesn&apos;t: it proves this site&apos;s parsing and rules engine reconstruct
        the source&apos;s own stated total correctly &mdash; a real check against a real number, not a check against
        thin air. It does <em>not</em> prove agreement with any other outlet&apos;s number. Other sites will
        sometimes show a different total, usually because they handle cap holds or incentives differently, or
        because they include charge types (see item 2) this site doesn&apos;t source yet. When our number disagrees
        with another site, we fix our rules engine or explain the difference here &mdash; we don&apos;t quietly nudge
        a figure to match consensus.
      </p>

      <h2 className="mt-8 text-lg font-semibold">8. Projected seasons</h2>
      <p className="mt-2 text-sm leading-relaxed">
        The salary cap, tax level, and both aprons are announced by the league one season at a time. Any season
        this site hasn&apos;t seen an official figure for yet would be rendered as a dashed, labeled
        &ldquo;projected&rdquo; line rather than a solid one. As of today, every season on this site uses real,
        announced figures &mdash; nothing currently on the site is a projection, though the mechanism exists and
        will apply automatically the moment a future season is added ahead of its official announcement.
      </p>

      <h2 className="mt-8 text-lg font-semibold">9. The toggles, briefly</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
        <li><strong>Basis</strong> (cap / tax / apron) &mdash; which of the three hits (item 1) the chart displays and measures against every threshold line.</li>
        <li><strong>Exclude dead money &amp; holds</strong> &mdash; removes those charge types from the stack and total entirely.</li>
        <li><strong>% of season cap</strong> &mdash; rescales the display only; whether a total actually crosses a threshold line is always decided using real dollars first, so this toggle can never change that answer, only how it&apos;s displayed.</li>
        <li><strong>Guaranteed only</strong> &mdash; shows only the guaranteed portion of each charge (item 4); fully non-guaranteed charges disappear from the stack rather than showing as $0.</li>
      </ul>
      <p className="mt-2 text-sm leading-relaxed text-[#52514e]">
        None of these toggles change the underlying stored data &mdash; they&apos;re display and selection choices
        applied on top of the same sourced/computed/estimated figures described above.
      </p>
    </main>
  );
}
