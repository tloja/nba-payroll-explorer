import type { ReactNode } from 'react';

// One bounded card per topic — the "light bento-style grouping" M12 asks
// for on the content pages, since their content really is a sequence of
// self-contained chunks (methodology's own numbered items, one glossary
// term, one data source) rather than a single scroll of undifferentiated
// prose. `index` renders a real ordinal, not a decorative marker — several
// of these pages (methodology, the corrections log) number their sections
// on purpose, and that order carries real meaning (methodology's items are
// referenced by number from other pages); omit it for content that has no
// real sequence (glossary terms, sources).
export function Section({
  heading,
  index,
  emphasis = false,
  children,
}: {
  heading: string;
  index?: number;
  emphasis?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border p-5 ${emphasis ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`}
    >
      <h2 className="flex items-baseline gap-2 text-lg font-semibold tracking-tight text-ink">
        {index != null && (
          <span className="font-mono text-sm font-normal text-ink-muted" aria-hidden="true">
            {String(index).padStart(2, '0')}
          </span>
        )}
        {heading}
      </h2>
      <div className="mt-2 flex flex-col gap-2 text-sm leading-relaxed text-ink [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_strong]:text-ink [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-accent-strong">
        {children}
      </div>
    </section>
  );
}

// Muted secondary paragraph within a Section — the "disclosed gap" /
// "worth flagging" asides that already existed as a lighter ink color
// before M12; kept as a distinct visual register, now token-based.
export function Aside({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-relaxed text-ink-muted">{children}</p>;
}
