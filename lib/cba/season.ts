import type { Season } from '../types';

export function nextSeason(season: Season): Season {
  const [startYear] = season.split('-').map(Number);
  const nextStart = startYear + 1;
  const nextEndSuffix = String((nextStart + 1) % 100).padStart(2, '0');
  return `${nextStart}-${nextEndSuffix}` as Season;
}

export function addSeasons(season: Season, offset: number): Season {
  let result = season;
  for (let i = 0; i < offset; i++) result = nextSeason(result);
  return result;
}
