import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Glossary — NBA Payroll Explorer',
  description: 'Plain-language definitions of the salary cap, tax, apron, and contract terms used on this site.',
};

type Term = { term: string; definition: string };

const TERMS: Term[] = [
  {
    term: 'Salary cap',
    definition:
      'The league-wide target for team payroll each season, announced annually. Teams can exceed it through various exceptions, so it functions more as a soft ceiling than a hard limit for most teams.',
  },
  {
    term: 'Luxury tax / tax level',
    definition:
      'A threshold above the salary cap. Teams whose payroll crosses it pay a dollar-for-dollar (and increasingly steep) tax on the excess to the league, which redistributes it to teams under the tax line.',
  },
  {
    term: 'Apron (first and second)',
    definition:
      'Two thresholds above the luxury tax line. Crossing either one restricts what a team can do — which trade and free-agency tools it can use, whether it can sign players via the buyout market, and more. The stricter penalties apply above the second apron. This site shades the portion of each team’s bar above these lines to show not just whether a team is over, but by how much.',
  },
  {
    term: 'Hard cap',
    definition:
      'A cap a team cannot exceed at all once triggered (unlike the salary cap itself, which is soft). Using certain exceptions or acquiring certain players hard-caps a team at the first or second apron for the rest of that season.',
  },
  {
    term: 'Cap hold',
    definition:
      'A placeholder charge for a team’s own free agent, counted against the cap even though the player hasn’t signed anywhere yet. It exists so a team can’t both keep a player’s rights and pretend the cap space is free. Renouncing the player or re-signing them removes or replaces the hold.',
  },
  {
    term: 'Draft-rights hold',
    definition:
      'Like a cap hold, but for a drafted player who hasn’t signed a contract yet — held at 120% of that pick’s rookie-scale salary until they sign or the team renounces their rights.',
  },
  {
    term: 'Incomplete-roster charge',
    definition:
      'If a team carries fewer than 12 players under contract, a minimum-salary placeholder is added to the cap for each empty spot below 12, so a team can’t manufacture cap space by simply not filling its roster.',
  },
  {
    term: 'Dead money',
    definition:
      'Guaranteed salary still owed to a player no longer on the roster, most often after a waiver. It still counts against the cap for as long as it’s owed, and can be large — it’s invisible on most simple payroll summaries but modeled explicitly on this site.',
  },
  {
    term: 'Stretch provision',
    definition:
      'A rule letting a team spread a waived player’s remaining guaranteed money over more seasons than were left on the contract (twice the remaining years, plus one), lowering the cap hit in any single season at the cost of carrying it for longer.',
  },
  {
    term: 'Two-way contract',
    definition:
      'A contract for a player who splits time between the NBA roster and its G League affiliate. Two-way salaries do not count against team salary at all, and don’t appear anywhere on this site’s charts.',
  },
  {
    term: 'Bird rights',
    definition:
      'A rule letting a team re-sign its own free agent above the cap, once that player has been with the team (without being renounced or changing teams as a free agent) for a qualifying number of seasons — three for full Bird rights, with partial versions (Early Bird, Non-Bird) available sooner but with smaller raises allowed.',
  },
  {
    term: 'Exception (MLE, BAE, etc.)',
    definition:
      'A CBA-defined tool letting a team sign or re-sign a player for more than the cap would otherwise allow, even without cap space. The mid-level exception (MLE) and bi-annual exception (BAE) are the most common; the exact amount and which version a team can use depends on how far over the cap and aprons that team already is.',
  },
  {
    term: 'Rookie scale',
    definition:
      'A fixed salary schedule for first-round draft picks’ first four seasons, set by the CBA rather than negotiated. Years three and four are typically team options.',
  },
  {
    term: 'Max / supermax contract',
    definition:
      'A contract at the highest salary percentage a player is eligible for under the CBA. A "supermax" is a specific, higher tier available only to players who meet extra eligibility criteria (such as an All-NBA selection) and are re-signing with the team that drafted them or that has held their Bird rights.',
  },
  {
    term: 'Guarantee status (full / partial / none)',
    definition:
      'Whether a season’s salary is owed to the player even if they’re waived. Fully guaranteed money is owed regardless; a non-guaranteed season costs the team nothing if the player is waived before it starts; a partial guarantee is somewhere in between, for a specific dollar amount.',
  },
  {
    term: 'Option year (player / team / ETO)',
    definition:
      'A season where one side gets to decide whether the contract continues. A player option lets the player choose; a team option lets the team choose; an early termination option (ETO) lets the player opt out of remaining seasons early. Until decided, this site treats that season’s figure as estimated — see methodology.',
  },
  {
    term: 'Derivation (sourced / computed / estimated / synthetic)',
    definition:
      'This site’s own label for how confident a given dollar figure is — not a general NBA term, but used throughout the charts and tables here. See methodology for exactly what each one means.',
  },
];

export default function GlossaryPage() {
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/" className="text-sm text-[#52514e] underline">
        &larr; Home
      </Link>
      <h1 className="mt-2 text-xl font-semibold">Glossary</h1>
      <p className="mt-2 text-sm leading-relaxed text-[#52514e]">
        Plain-language definitions for terms used across this site. For how these rules are actually applied to
        compute the figures you see, see{' '}
        <Link href="/methodology" className="underline">
          methodology
        </Link>
        .
      </p>

      <dl className="mt-6 space-y-6">
        {TERMS.map(({ term, definition }) => (
          <div key={term}>
            <dt className="text-sm font-semibold">{term}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-[#1c1b19]">{definition}</dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
