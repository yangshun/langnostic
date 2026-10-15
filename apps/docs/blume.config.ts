import { defineConfig } from 'blume';
import { orama } from 'blume/search';

export default defineConfig({
  title: 'Langnostic',
  description:
    'Fast, scalable, and efficient translation system to continuously translate strings within React components + Markdown documents using AI.',
  basePath: '/docs',
  deployment: { site: 'https://langnostic.com' },
  content: { root: 'content/docs' },
  logo: { text: 'Langnostic', href: '/' },
  theme: { accent: 'blue', mode: 'system' },
  navigation: {
    actions: [{ label: 'Documentation', href: '/' }],
    sidebar: [
      { label: 'Getting started', items: ['/', '/quick-start'] },
      {
        label: 'Guide',
        items: ['/features', '/cli', '/workflows', '/plugins'],
      },
      { label: 'Advanced', items: ['/architecture'] },
      { label: 'Resources', items: ['/roadmap'] },
    ],
  },
  search: orama(),
  agents: { llmsTxt: true },
  seo: {
    metatags: {
      author: 'GreatFrontEnd',
      keywords:
        'translation, i18n, internationalization, AI translation, localization, React, MDX, JSON',
    },
  },
});
