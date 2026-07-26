import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Descriptive User-Agent with a contact URL (spec §3). Domain is not yet
// registered — replace once the site has one. Flagged in DATA-SOURCING.md /
// NOTES.md as a TODO, not silently left as a real-looking URL.
export const USER_AGENT = 'NBAPayrollExplorerBot/0.1 (+https://<site-domain-tbd>/about)';

export class AbortRunError extends Error {
  constructor(
    public readonly status: number,
    url: string,
  ) {
    super(`Aborting ingestion run: received HTTP ${status} fetching ${url}`);
    this.name = 'AbortRunError';
  }
}

// Reads and parses the `User-agent: *` block of robots.txt for a Crawl-delay
// directive. Throws rather than assuming a fallback delay if one isn't
// present — the number a human decided on, not one the code guessed.
export async function fetchRobotsPolicy(baseUrl: string): Promise<{ crawlDelayMs: number }> {
  const res = await fetch(new URL('/robots.txt', baseUrl), { headers: { 'User-Agent': USER_AGENT } });
  if (res.status === 429 || res.status === 403) {
    throw new AbortRunError(res.status, res.url);
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch robots.txt: HTTP ${res.status}`);
  }
  const text = await res.text();
  const crawlDelaySeconds = parseCrawlDelay(text);
  if (crawlDelaySeconds === undefined) {
    throw new Error(
      'robots.txt has no Crawl-delay directive for User-agent: * — refusing to guess a default. ' +
        'Set one explicitly before running ingestion.',
    );
  }
  return { crawlDelayMs: crawlDelaySeconds * 1000 };
}

// Exported for testing — parses only the `User-agent: *` block, per robots.txt
// semantics (a directive under a different user-agent block doesn't apply to
// us unless we also match that specific agent name).
export function parseCrawlDelay(robotsTxt: string): number | undefined {
  const lines = robotsTxt.split(/\r?\n/);
  let inWildcardBlock = false;
  let crawlDelay: number | undefined;

  for (const rawLine of lines) {
    const line = rawLine.split('#')[0].trim();
    if (line === '') continue;

    const [rawKey, ...rest] = line.split(':');
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(':').trim();

    if (key === 'user-agent') {
      inWildcardBlock = value === '*';
      continue;
    }
    if (inWildcardBlock && key === 'crawl-delay') {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) crawlDelay = parsed;
    }
  }

  return crawlDelay;
}

function cachePathFor(cacheDir: string, teamSlug: string): string {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return path.join(cacheDir, `${teamSlug}.${today}.html`);
}

export type FetchedPage = { html: string; retrievedAt: string; sourceUrl: string; fromCache: boolean };

// Single sequential request for one team's contract page. Reads from the
// on-disk cache if today's copy already exists — re-fetching daily at most,
// per spec §3's "cache aggressively, re-fetch on the order of days."
// On 429/403, throws immediately (AbortRunError) rather than retrying —
// the whole run aborts per the M3 instructions.
//
// `fromCache` tells a multi-team caller (scripts/orchestrate.ts) whether this
// call actually hit the network, so it only advances its own crawl-delay
// clock on live fetches — a cache hit made no request and shouldn't force an
// unrelated wait before the next team's live fetch.
export async function fetchTeamContractsPage(
  teamSlug: string,
  opts: { baseUrl: string; cacheDir: string; crawlDelayMs: number; lastRequestAt?: number },
): Promise<FetchedPage> {
  const cachePath = cachePathFor(opts.cacheDir, teamSlug);
  const sourceUrl = new URL(`/contracts/${teamSlug}.html`, opts.baseUrl).toString();

  try {
    const cached = await readFile(cachePath, 'utf-8');
    return { html: cached, retrievedAt: new Date().toISOString(), sourceUrl, fromCache: true };
  } catch {
    // no cached copy for today — fall through to a live fetch
  }

  if (opts.lastRequestAt !== undefined) {
    const elapsed = Date.now() - opts.lastRequestAt;
    const wait = opts.crawlDelayMs - elapsed;
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  }

  const res = await fetch(sourceUrl, { headers: { 'User-Agent': USER_AGENT } });
  if (res.status === 429 || res.status === 403) {
    throw new AbortRunError(res.status, sourceUrl);
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch ${sourceUrl}: HTTP ${res.status}`);
  }

  const html = await res.text();
  const retrievedAt = new Date().toISOString();

  await mkdir(opts.cacheDir, { recursive: true });
  await writeFile(cachePath, html, 'utf-8');

  return { html, retrievedAt, sourceUrl, fromCache: false };
}
