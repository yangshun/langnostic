import { RootProvider } from 'fumadocs-ui/provider/next';
import { Inter } from 'next/font/google';
import '@/app/global.css';
import type { Metadata } from 'next';
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
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
