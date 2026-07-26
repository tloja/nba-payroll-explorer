import { describe, expect, it } from 'vitest';
import { parseCrawlDelay } from '../fetch';

// Basketball-Reference's actual robots.txt (fetched 2026-07-25), frozen here
// so the parser is tested without a network call.
const REAL_ROBOTS_TXT = `User-agent: AhrefsBot
Disallow: /

User-agent: GPTBot
Disallow: /

User-agent: Twitterbot
Disallow:

User-agent: *
Disallow: /basketball/
Disallow: /blazers/
Disallow: /dump/
Disallow: /fc/
Disallow: /my/
Disallow: /7103
Disallow: /play-index/*.cgi?*
Disallow: /play-index/plus/*.cgi?*
Disallow: */gamelog/
Disallow: */splits/
Disallow: */on-off/
Disallow: */lineups/
Disallow: */shooting/

Disallow: /req/
Disallow: /short/
Disallow: /nocdn/

Crawl-delay: 3

# Disallow the plagiarism.org robot, www.slysearch.com
User-agent: SlySearch
User-agent: GroundControl
Disallow: /
`;

describe('parseCrawlDelay', () => {
  it('reads the Crawl-delay directive under the User-agent: * block', () => {
    expect(parseCrawlDelay(REAL_ROBOTS_TXT)).toBe(3);
  });

  it('does not pick up a Crawl-delay from a different user-agent block', () => {
    const text = 'User-agent: SomeOtherBot\nCrawl-delay: 99\n\nUser-agent: *\nDisallow: /private/\n';
    expect(parseCrawlDelay(text)).toBeUndefined();
  });

  it('returns undefined when no Crawl-delay is present at all', () => {
    expect(parseCrawlDelay('User-agent: *\nDisallow: /private/\n')).toBeUndefined();
  });
});
