// The public corrections log (spec §8/§11 M7): what's been fixed, and when.
// Empty at launch — genuinely no corrections have been made yet, not a stub
// waiting to be wired up. Append an entry here (chronological, newest last is
// fine; the page sorts) whenever a reported error changes what's on the site.
export type CorrectionLogEntry = {
  date: string; // "YYYY-MM-DD", the date the correction shipped
  scope: string; // e.g. "Oklahoma City Thunder, 2026-27"
  description: string; // what was wrong
  resolution: string; // what changed
};

export const CORRECTIONS_LOG: CorrectionLogEntry[] = [];
