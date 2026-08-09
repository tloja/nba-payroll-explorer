import type { Metadata } from 'next';
import Script from 'next/script';
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import './globals.css';
import { Footer } from '../components/Footer';
import { SentryInit } from '../components/SentryInit';
import { SiteHeader } from '../components/SiteHeader';
import { ThemeScript } from '../components/ThemeScript';
import { SITE_HOST, SITE_NAME, SITE_URL } from '../lib/site';

// next/font/google self-hosts at build time (no runtime font-CDN request —
// works under `output: 'export'`, and means the CSP never needs a
// font-src exception). IBM Plex was designed for dense technical/financial
// UI rather than picked for its "safe default" familiarity (see
// tailwind.config.ts's comment) — Sans for prose/UI, Mono for every dollar
// figure the site already renders tabular (spec §5's "tabular/monospace
// numerals throughout").
const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

// metadataBase lets every route's relative canonical/OG/image URL (including
// the file-convention opengraph-image.tsx routes) resolve to an absolute
// SITE_URL-based URL without each page re-deriving it.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_NAME,
  description: 'NBA team payroll stacks against the salary cap, tax line, and both apron thresholds.',
  openGraph: {
    siteName: SITE_NAME,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body className="flex min-h-screen flex-col bg-paper font-sans text-ink antialiased">
        {/* Must run before anything paints (M12: respect prefers-color-scheme
            on first load, with a manual override) — see ThemeScript's own
            comment for why this has to be a blocking <script>, not an
            effect. */}
        <ThemeScript />
        {/* Plausible: cookie-free, no consent banner needed (spec §4). Silently
            ignores traffic until SITE_HOST is a real domain registered with
            Plausible — no code change needed when that happens. */}
        <Script defer data-domain={SITE_HOST} src="https://plausible.io/js/script.js" strategy="afterInteractive" />
        <SentryInit />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-ink focus:outline focus:outline-2 focus:outline-accent"
        >
          Skip to main content
        </a>
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
