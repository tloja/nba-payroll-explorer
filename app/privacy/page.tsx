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
        <li>It sets no cookies.</li>
        <li>It includes no analytics, tracking pixels, or third-party scripts of any kind.</li>
        <li>It has no user accounts, no login, and stores nothing about who visits.</li>
        <li>It does not sell or share data, because it does not collect any to begin with.</li>
      </ul>

      <h2 className="mt-8 text-lg font-semibold">What it might collect, and when</h2>
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

      <h2 className="mt-8 text-lg font-semibold">If this changes</h2>
      <p className="mt-2 text-sm leading-relaxed">
        If analytics, a corrections form with its own backend, or any cookie-setting feature is ever added, this
        page will be rewritten to describe exactly what was added and why &mdash; not patched with boilerplate
        language written in advance of an actual change.
      </p>
    </main>
  );
}
