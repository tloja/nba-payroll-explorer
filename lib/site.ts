// Single source of truth for the site's public base URL (spec §10: sitemap,
// canonical tags, JSON-LD, OG images, and the download-PNG watermark all need
// one absolute origin). No domain is registered yet — see DATA-SOURCING.md
// and NOTES.md's M7 entry, which already used a `<site-domain-tbd>`
// placeholder in scripts/ingest/basketball-reference/fetch.ts's User-Agent
// for the same reason. `NEXT_PUBLIC_SITE_URL` overrides this in any
// environment that has a real domain; until then every consumer imports this
// one constant instead of hardcoding a guess.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://nba-payroll-explorer.example').replace(
  /\/$/,
  '',
);

export const SITE_NAME = 'NBA Payroll Explorer';

export const SITE_HOST = new URL(SITE_URL).host;
