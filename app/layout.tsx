import type { Metadata } from 'next';
import './globals.css';
import { Footer } from '../components/Footer';
import { SITE_NAME, SITE_URL } from '../lib/site';

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
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-[#f9f9f7] text-[#0b0b0b] antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-[#0b0b0b] focus:outline focus:outline-2 focus:outline-black"
        >
          Skip to main content
        </a>
        <div className="flex-1">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
