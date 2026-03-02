import { Banner } from 'fumadocs-ui/components/banner';
import { RootProvider } from 'fumadocs-ui/provider/next';

import '@/app/global.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';

const inter = Inter({
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'Langnostic - AI-Powered Translation for Modern Apps',
    template: '%s | Langnostic',
  },
  description:
    'Fast, scalable, and efficient translation system to continuously translate strings within React components + Markdown documents using AI.',
  keywords: [
    'translation',
    'i18n',
    'internationalization',
    'AI translation',
    'localization',
    'React',
    'MDX',
    'JSON',
  ],
  authors: [{ name: 'GreatFrontEnd' }],
  openGraph: {
    title: 'Langnostic - AI-Powered Translation for Modern Apps',
    description:
      'Fast, scalable, and efficient translation system to continuously translate strings within React components + Markdown documents using AI.',
    type: 'website',
  },
};
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <Banner>
          <p className="text-xs md:text-sm">
            We are preparing to open source Langnostic for public use. Follow{' '}
            <a
              className="underline"
              href="https://www.linkedin.com/company/greatfrontend"
              target="_blank"
              rel="noopener noreferrer"
            >
              GreatFrontEnd on LinkedIn
            </a>{' '}
            for updates or{' '}
            <a
              className="underline"
              href="mailto:team@greatfrontend.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              shoot us an email
            </a>
            .
          </p>
        </Banner>
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
