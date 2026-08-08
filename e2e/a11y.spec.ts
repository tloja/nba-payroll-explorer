import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// WCAG 2.1 AA per CLAUDE.md / spec §9. Runs against a real Chromium render
// (not jsdom) because axe's color-contrast checks need actual computed
// styles and layout. One route per distinct page shape: the league overview,
// a team page (season selector dormant today, single-season data), and the
// season deep link.
// M11 added /team/okc/2027-28 (a projected, sparser season with real
// unresolved-option segments — see PayrollChart's dotted-outline overlay)
// as its own route: worth its own axe pass since it's genuinely new
// surface, not just a re-render of the 2026-27 deep link with different data.
const ROUTES = ['/', '/team/okc', '/team/okc/2026-27', '/team/okc/2027-28'];

// M7's public-surface pages (spec §7/§8/§11): static prose/table content,
// no chart or view-mode toggle, so these get one axe pass each rather than
// the chart+table loop below.
const STATIC_PAGES = ['/methodology', '/sources', '/glossary', '/corrections', '/about', '/privacy'];

async function runAxe(page: import('@playwright/test').Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  // eslint-disable-next-line no-console
  console.log(
    `\n=== ${label}: ${results.violations.length} violation(s) ===\n` +
      JSON.stringify(
        results.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          help: v.help,
          helpUrl: v.helpUrl,
          nodes: v.nodes.map((n) => ({ target: n.target, html: n.html, failureSummary: n.failureSummary })),
        })),
        null,
        2,
      ),
  );

  expect(results.violations).toEqual([]);
}

for (const route of ROUTES) {
  test(`${route} has no WCAG 2.1 A/AA violations`, async ({ page }) => {
    await page.goto(route);
    await runAxe(page, route);
  });

  // The M6 data-table equivalent (spec §9 item 1) is new surface this
  // session added — worth its own axe pass so a future regression there
  // (e.g. a malformed <table>/<th scope>) fails CI same as the chart itself.
  test(`${route} table view has no WCAG 2.1 A/AA violations`, async ({ page }) => {
    await page.goto(route);
    await page.getByRole('button', { name: 'View as table' }).click();
    await expect(page.locator('table')).toBeVisible();
    await runAxe(page, `${route} (table view)`);
  });
}

for (const route of STATIC_PAGES) {
  test(`${route} has no WCAG 2.1 A/AA violations`, async ({ page }) => {
    await page.goto(route);
    await runAxe(page, route);
  });
}
