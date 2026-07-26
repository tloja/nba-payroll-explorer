import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy — NBA Payroll Explorer',
  description: 'What this site actually collects, stated plainly rather than a generic privacy policy template.',
};

export default function PrivacyPage() {
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/" className="text-sm text-[#52514e] underline">
        &larr; Home
      </Link>
      <h1 className="mt-2 text-xl font-semibold">Privacy</h1>

      <p className="mt-4 text-sm leading-relaxed">
        This page describes what this site actually collects today, not a generic template. It will be updated if
        that ever changes.
      </p>

      <h2 className="mt-8 text-lg font-semibold">What this site does not do</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
        <li>It sets no cookies &mdash; not for analytics, not for error monitoring, not for anything else.</li>
        <li>It has no user accounts, no login, and stores nothing about who visits tied to an identity.</li>
        <li>It does not sell or share data, because none of what it collects (below) identifies you.</li>
      </ul>

      <h2 className="mt-8 text-lg font-semibold">Analytics: Plausible</h2>
      <p className="mt-2 text-sm leading-relaxed">
        This site uses{' '}
        <a href="https://plausible.io" className="underline" rel="noopener noreferrer">
          Plausible
        </a>
        , a cookie-free analytics service, to see aggregate traffic (which pages get visited, roughly how much
        traffic, which sites link here). Plausible does not use cookies or any persistent identifier, does not
        track you across other sites, and does not build an individual profile of any visitor &mdash; which is why
        this site has no cookie-consent banner. See{' '}
        <a href="https://plausible.io/data-policy" className="underline" rel="noopener noreferrer">
          Plausible&apos;s own data policy
        </a>{' '}
        for exactly what it computes from a page view.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Error monitoring: Sentry</h2>
      <p className="mt-2 text-sm leading-relaxed">
        This site uses{' '}
        <a href="https://sentry.io" className="underline" rel="noopener noreferrer">
          Sentry
        </a>{' '}
        to catch JavaScript errors in your browser (e.g. the chart failing to render) so they can actually get
        fixed instead of silently failing for whoever hits them. It runs client-side only &mdash; there is no
        server behind this site for it to monitor. It is configured to not send default personal
        information (IP address, cookies) alongside error reports; what it does send is the error itself
        (message, stack trace, which page and browser) needed to reproduce and fix the bug.
      </p>

      <h2 className="mt-8 text-lg font-semibold">What else might be collected, and when</h2>
      <p className="mt-2 text-sm leading-relaxed">
        This site is a set of static, pre-built pages served from a hosting provider or CDN. Like essentially any web
        server, whatever infrastructure ends up serving this site may keep its own basic access logs (e.g. IP
        address, requested page, timestamp) for operational purposes such as diagnosing outages or abuse &mdash; this
        is standard behavior for the underlying hosting, not something this site&apos;s own code adds, configures, or
        has access to beyond that.
      </p>
      <p className="mt-2 text-sm leading-relaxed">
        If you email us (see{' '}
        <Link href="/corrections" className="underline">
          corrections
        </Link>{' '}
        or{' '}
        <Link href="/about" className="underline">
          about
        </Link>
        ), we obviously receive whatever you send in that email. That&apos;s a conversation you started, not
        something collected passively.
      </p>

      <h2 className="mt-8 text-lg font-semibold">If this changes further</h2>
      <p className="mt-2 text-sm leading-relaxed">
        If a corrections form with its own backend, or any cookie-setting feature, is ever added, this page will
        be rewritten to describe exactly what was added and why &mdash; not patched with boilerplate language
        written in advance of an actual change. The two sections above were written the same way, at the point
        Plausible and Sentry actually got wired in, not before.
      </p>
    </main>
  );
}
