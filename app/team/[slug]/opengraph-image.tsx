import { ImageResponse } from 'next/og';
import { listTeamSlugs, loadTeamFile } from '../../../lib/data/teams';
import { availableSeasonsFor, toPayrollData } from '../../../lib/data/teamPayroll';
import { renderTeamOgImage } from '../../../lib/og/renderTeamChart';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export function generateStaticParams() {
  return listTeamSlugs().map((slug) => ({ slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = loadTeamFile(slug);

  if (!result.ok) {
    return new ImageResponse(
      renderTeamOgImage({ teamId: slug, teamLabel: slug.toUpperCase(), thresholds: [], capCharges: [] }, []),
      size,
    );
  }

  const seasons = availableSeasonsFor(result.data);
  const fixture = toPayrollData(result.data, seasons);
  return new ImageResponse(renderTeamOgImage(fixture, seasons), size);
}
