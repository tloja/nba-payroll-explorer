import { SITE_URL } from '../lib/site';

/**
 * schema.org SportsTeam markup (spec §10 item 5). Deliberately minimal: name,
 * sport, and this site's own URL for the team — no `logo`/`image` (CLAUDE.md:
 * no team/league logos anywhere) and no `memberOf` league entity, since this
 * is an independent, unaffiliated project (Footer.tsx's TRADEMARK_DISCLAIMER)
 * and asserting a formal schema.org relationship to the NBA isn't ours to
 * claim.
 */
export function TeamStructuredData({ teamLabel, slug }: { teamLabel: string; slug: string }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'SportsTeam',
    name: teamLabel,
    sport: 'Basketball',
    url: `${SITE_URL}/team/${slug}`,
  };

  return (
    // eslint-disable-next-line react/no-danger
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}
