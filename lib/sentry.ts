import * as Sentry from '@sentry/react';

// Client-side only (spec §4/§11) — this is a fully static export with no
// server to instrument. Reads NEXT_PUBLIC_SENTRY_DSN (must be NEXT_PUBLIC_
// since static export bakes env vars in at build time, not read at request
// time) and no-ops cleanly when it's unset, so the site works identically
// before a Sentry project exists and after one is wired up on the host.
let initialized = false;

export function initSentry(): void {
  if (initialized || typeof window === 'undefined') return;
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    sendDefaultPii: false,
    tracesSampleRate: 0,
  });
  initialized = true;
}
