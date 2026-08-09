// M12 brief item 4: modernize the Basis / Exclude dead money / % of cap /
// Guaranteed only controls into a cohesive pill/segmented cluster rather than
// a plain <select> + checkboxes. Both primitives here keep a real native
// <input> (radio or checkbox) — visually hidden, not removed — so keyboard
// operation, form semantics, and screen-reader state come from the browser
// for free; only the *label*'s appearance is custom. `has-[:checked]` /
// `has-[:focus-visible]` (Tailwind's arbitrary-variant syntax over native
// CSS :has()) let the label react to its own descendant input without any
// JS-managed class list.
//
// Pure presentation — no chart logic, no toggle *behavior* lives here. That
// stays in TeamPageClient, which already owns the URL/toggles translation
// (spec §6, M5).

const PILL_BASE =
  'cursor-pointer select-none rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink-muted outline-none transition-colors hover:text-ink has-[:checked]:border-accent has-[:checked]:bg-accent has-[:checked]:text-accent-ink has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent';

export function SegmentedControl<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  name: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="mr-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">{legend}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <label key={opt.value} className={PILL_BASE}>
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="sr-only"
            />
            {opt.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function TogglePill({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={PILL_BASE}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      {label}
    </label>
  );
}
