// M3 CLI: runs the Basketball-Reference adapter for ONE team only (OKC), per
// the M3 instructions — looping all 30 teams is scoped to a later session
// once this team's output has been hand-checked against the source page.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ingestTeam } from './basketball-reference';
import { AbortRunError } from './basketball-reference/fetch';

const TEAM_SLUG = 'OKC';
const TEAM_LABEL = 'Oklahoma City Thunder';
const OUTPUT_PATH = path.join(process.cwd(), 'data', 'teams', 'okc.json');

async function main(): Promise<number> {
  console.log(`Ingesting ${TEAM_LABEL} (${TEAM_SLUG}) from Basketball-Reference...`);

  const { capCharges, reportedTotals } = await ingestTeam(TEAM_SLUG);

  const output = { teamId: TEAM_SLUG, teamLabel: TEAM_LABEL, capCharges, reportedTotals };
  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n', 'utf-8');

  const bySeason = new Map<string, number>();
  for (const c of capCharges) bySeason.set(c.season, (bySeason.get(c.season) ?? 0) + c.capHit);

  console.log(`Wrote ${capCharges.length} cap charges to ${path.relative(process.cwd(), OUTPUT_PATH)}`);
  for (const [season, total] of [...bySeason.entries()].sort()) {
    console.log(`  ${season}: $${total.toLocaleString('en-US')} (capHit sum, ${capCharges.filter((c) => c.season === season).length} charges)`);
  }

  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    if (err instanceof AbortRunError) {
      console.error(`\n${err.message}`);
      console.error('Aborting the entire run — no retry, per M3 instructions.');
      process.exit(1);
    }
    console.error('\nIngestion failed:', err);
    process.exit(1);
  });
