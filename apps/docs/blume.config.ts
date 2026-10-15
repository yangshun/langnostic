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
      {
        label: 'Getting started',
        items: ['/', '/why', '/features', '/quick-start'],
      },
      { label: 'Guides', items: ['/workflows', '/plugins'] },
      {
        label: 'References',
        items: ['/cli', '/configuration', '/plugin-api', '/utilities'],
      },
      {
        label: 'Plugins',
        items: ['/plugins/formatjs', '/plugins/mdx'],
      },
      {
        label: 'Resources',
        items: ['/architecture', '/philosophy', '/comparisons', '/roadmap'],
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
