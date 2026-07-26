// All 30 NBA franchises, keyed by the slug Basketball-Reference uses in its
// /contracts/<slug>.html URLs. Several of these differ from the team's common
// three-letter abbreviation (Nets, Hornets, Suns) — sourced directly from BR's
// own site navigation, not guessed from convention.
export type TeamEntry = { slug: string; label: string };

export const NBA_TEAMS: TeamEntry[] = [
  { slug: 'ATL', label: 'Atlanta Hawks' },
  { slug: 'BOS', label: 'Boston Celtics' },
  { slug: 'BRK', label: 'Brooklyn Nets' },
  { slug: 'CHO', label: 'Charlotte Hornets' },
  { slug: 'CHI', label: 'Chicago Bulls' },
  { slug: 'CLE', label: 'Cleveland Cavaliers' },
  { slug: 'DAL', label: 'Dallas Mavericks' },
  { slug: 'DEN', label: 'Denver Nuggets' },
  { slug: 'DET', label: 'Detroit Pistons' },
  { slug: 'GSW', label: 'Golden State Warriors' },
  { slug: 'HOU', label: 'Houston Rockets' },
  { slug: 'IND', label: 'Indiana Pacers' },
  { slug: 'LAC', label: 'LA Clippers' },
  { slug: 'LAL', label: 'Los Angeles Lakers' },
  { slug: 'MEM', label: 'Memphis Grizzlies' },
  { slug: 'MIA', label: 'Miami Heat' },
  { slug: 'MIL', label: 'Milwaukee Bucks' },
  { slug: 'MIN', label: 'Minnesota Timberwolves' },
  { slug: 'NOP', label: 'New Orleans Pelicans' },
  { slug: 'NYK', label: 'New York Knicks' },
  { slug: 'OKC', label: 'Oklahoma City Thunder' },
  { slug: 'ORL', label: 'Orlando Magic' },
  { slug: 'PHI', label: 'Philadelphia 76ers' },
  { slug: 'PHO', label: 'Phoenix Suns' },
  { slug: 'POR', label: 'Portland Trail Blazers' },
  { slug: 'SAC', label: 'Sacramento Kings' },
  { slug: 'SAS', label: 'San Antonio Spurs' },
  { slug: 'TOR', label: 'Toronto Raptors' },
  { slug: 'UTA', label: 'Utah Jazz' },
  { slug: 'WAS', label: 'Washington Wizards' },
];
