import { defineConfig } from 'blume';
import { orama } from 'blume/search';

export default defineConfig({
  title: 'Langnostic',
  description:
    'Translate FormatJS message catalogs and Markdown documents with AI, using your own provider and keeping translations in your repository.',
  basePath: '/docs',
  deployment: { site: 'https://langnostic.com' },
  content: { root: 'content/docs' },
  logo: { text: 'Langnostic', href: '/' },
  theme: { accent: 'blue', mode: 'system' },
  navigation: {
    actions: [{ label: 'Documentation', href: '/' }],
    sidebar: [
      { label: 'Getting started', items: ['/', '/why', '/quick-start'] },
      {
        label: 'Guide',
        items: [
          '/features',
          '/configuration',
          '/cli',
          '/workflows',
          '/plugins',
        ],
      },
      { label: 'Advanced', items: ['/architecture'] },
      {
        label: 'Resources',
        items: ['/philosophy', '/comparisons', '/roadmap'],
      },
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
