'use client';

import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PayrollChart } from '../chart/PayrollChart';
import { toPayrollData } from '../../lib/data/teamPayroll';
import type { TeamCapChargesFile } from '../../lib/verify/teamFile';
import type { Season } from '../../lib/types';
import { DEFAULT_TOGGLES, type ChartToggles, type DollarMode, type PayrollBasis } from '../../lib/chart/toggles';
import { SegmentedControl, TogglePill } from '../ui/Toggles';

const BASIS_OPTIONS: { value: PayrollBasis; label: string }[] = [
  { value: 'cap', label: 'Cap' },
  { value: 'tax', label: 'Tax' },
  { value: 'apron', label: 'Apron' },
];

const BASIS_VALUES: PayrollBasis[] = ['cap', 'tax', 'apron'];
const DOLLAR_MODE_VALUES: DollarMode[] = ['absolute', 'percent'];

/**
 * Reads the season range from the URL (spec §10: every view shareable),
 * clamps it to what this team actually has, and renders PayrollChart
 * against that sub-range. The range select only appears when there's more
 * than one season to pick from.
 *
 * Stack order (spec §5) always sorts by the range's last/most recent
 * season's capHit, applied to every season's bar — no user-facing "sort
 * by" control for this. One used to exist (a `focus` URL param + a select
 * next to From/To) but was removed as not worth exposing: picking which
 * season's dollar amounts determine top-to-bottom order didn't change the
 * underlying data, only the visual arrangement, and users found it
 * confusing rather than useful. PayrollChart's own `lastSeason` fallback
 * (used whenever no `focusSeason` prop is passed) already does exactly
 * this, so removing the control needed no change there.
 *
 * M5: also owns the pinned segment and the toggle set (spec §6), both in the
 * URL, both passed to PayrollChart as controlled props — this is the single
 * place URL state and chart state are translated into each other, same
 * pattern as from/to above, so pin/toggles can't drift out of sync with
 * what's actually rendered (see NOTES.md M5 entry). Hover and keyboard
 * focus are NOT here — they're PayrollChart's own ephemeral local state,
 * since neither belongs in a shareable link.
 *
 * Reused for /team/[slug]/[season] too: that route passes
 * `availableSeasons={[season]}`, which makes the range selector below
 * auto-hide (`availableSeasons.length > 1` is false) while pin/toggle URL
 * handling still applies — one implementation instead of a second,
 * divergent one for the deep-link route.
 */
export function TeamPageClient({
  slug,
  data,
  availableSeasons,
  basePath = `/team/${slug}`,
}: {
  slug: string;
  data: TeamCapChargesFile;
  availableSeasons: Season[];
  /** Defaults to /team/[slug]; the /team/[slug]/[season] deep link passes its
   * own path so pin/toggle updates don't navigate away from the season
   * segment. */
  basePath?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const first = availableSeasons[0];
  const last = availableSeasons[availableSeasons.length - 1];

  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');
  const pinParam = searchParams.get('pin');
  const basisParam = searchParams.get('basis');
  const holdsParam = searchParams.get('holds');
  const dollarsParam = searchParams.get('dollars');
  const guaranteeParam = searchParams.get('guarantee');

  const from = fromParam && availableSeasons.includes(fromParam as Season) ? (fromParam as Season) : first;
  const toRequested = toParam && availableSeasons.includes(toParam as Season) ? (toParam as Season) : last;
  const to = toRequested < from ? from : toRequested;

  const pinnedEntityId = pinParam || null;
  const toggles: ChartToggles = {
    basis: basisParam && (BASIS_VALUES as string[]).includes(basisParam) ? (basisParam as PayrollBasis) : DEFAULT_TOGGLES.basis,
    includeDeadMoneyAndHolds: holdsParam === 'exclude' ? false : DEFAULT_TOGGLES.includeDeadMoneyAndHolds,
    dollarMode:
      dollarsParam && (DOLLAR_MODE_VALUES as string[]).includes(dollarsParam)
        ? (dollarsParam as DollarMode)
        : DEFAULT_TOGGLES.dollarMode,
    guaranteedOnly: guaranteeParam === 'guaranteed' ? true : DEFAULT_TOGGLES.guaranteedOnly,
  };

  const rangeSeasons = useMemo(
    () => availableSeasons.filter((s) => s >= from && s <= to),
    [availableSeasons, from, to],
  );
  const payrollData = useMemo(() => toPayrollData(data, availableSeasons), [data, availableSeasons]);

  function updateParams(next: Partial<Record<'from' | 'to' | 'pin' | 'basis' | 'holds' | 'dollars' | 'guarantee', string>>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.replace(`${basePath}?${params.toString()}`);
  }

  return (
    <>
      {/* Season/basis/toggle controls — reserves the same right margin as
          the header block above and PayrollChart's legend block below (see
          app/team/[slug]/page.tsx for why this is a margin reservation +
          absolute-positioned chart rather than a CSS grid). Below lg, this
          is a plain div with no effect at all — same stacked layout as
          before. */}
      <div className="min-w-0 lg:w-[290px]">
      {/* Glassmorphism used sparingly (M12 brief item 5): a translucent card
          over the page background, not a heavy blur — grouping every chart
          control into one visually cohesive cluster instead of two loose
          rows of plain selects/checkboxes. */}
      <div className="glass-surface my-4 rounded-2xl border border-line p-3">
        {availableSeasons.length > 1 && (
          <fieldset className="mb-3 flex flex-wrap items-center gap-3 border-b border-line pb-3 text-sm">
            <legend className="mr-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">Season range</legend>
            <label className="flex items-center gap-1.5 text-ink">
              From
              <select
                value={from}
                onChange={(e) => updateParams({ from: e.target.value })}
                className="rounded-md border border-line bg-surface px-1.5 py-0.5 text-ink outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
              >
                {availableSeasons.map((s) => (
                  <option key={s} value={s} disabled={s > to}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-ink">
              To
              <select
                value={to}
                onChange={(e) => updateParams({ to: e.target.value })}
                className="rounded-md border border-line bg-surface px-1.5 py-0.5 text-ink outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
              >
                {availableSeasons.map((s) => (
                  <option key={s} value={s} disabled={s < from}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>
        )}

        <div className="flex flex-col gap-3">
          <SegmentedControl
            legend="Basis"
            name="basis"
            value={toggles.basis}
            options={BASIS_OPTIONS}
            onChange={(v) => updateParams({ basis: v === DEFAULT_TOGGLES.basis ? undefined : v })}
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">Filters</span>
            <TogglePill
              label="Exclude dead money & holds"
              checked={!toggles.includeDeadMoneyAndHolds}
              onChange={(checked) => updateParams({ holds: checked ? 'exclude' : undefined })}
            />
            <TogglePill
              label="% of season cap"
              checked={toggles.dollarMode === 'percent'}
              onChange={(checked) => updateParams({ dollars: checked ? 'percent' : undefined })}
            />
            <TogglePill
              label="Guaranteed only"
              checked={toggles.guaranteedOnly}
              onChange={(checked) => updateParams({ guarantee: checked ? 'guaranteed' : undefined })}
            />
          </div>
        </div>
      </div>
      </div>

      <PayrollChart
        fixture={payrollData}
        seasons={rangeSeasons}
        toggles={toggles}
        pinnedEntityId={pinnedEntityId}
        onPinChange={(id) => updateParams({ pin: id ?? undefined })}
      />
    </>
  );
}
