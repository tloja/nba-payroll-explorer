'use client';

import { useEffect } from 'react';
import { initSentry } from '../lib/sentry';

// Renders nothing — just runs the client-only Sentry init once on mount.
// A separate component (rather than inlining in layout.tsx) so the root
// layout itself doesn't need 'use client'.
export function SentryInit(): null {
  useEffect(() => {
    initSentry();
  }, []);
  return null;
}
