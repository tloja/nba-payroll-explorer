import { ImageResponse } from 'next/og';
import { listTeamSeasonPairs, loadTeamFile } from '../../../../lib/data/teams';
import { availableSeasonsFor, toPayrollData } from '../../../../lib/data/teamPayroll';
import { renderTeamOgImage } from '../../../../lib/og/renderTeamChart';
import type { Season } from '../../../../lib/types';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export function generateStaticParams() {
  return listTeamSeasonPairs();
}

export default async function Image({ params }: { params: Promise<{ slug: string; season: string }> }) {
  const { slug, season } = await params;
  const result = loadTeamFile(slug);

  if (!result.ok) {
    return new ImageResponse(
      renderTeamOgImage({ teamId: slug, teamLabel: slug.toUpperCase(), thresholds: [], capCharges: [] }, []),
      size,
    );
  }

  const available = availableSeasonsFor(result.data);
  const targetSeason = available.includes(season as Season) ? (season as Season) : available[available.length - 1];
  const fixture = toPayrollData(result.data, available);
  return new ImageResponse(renderTeamOgImage(fixture, targetSeason ? [targetSeason] : []), size);
}
