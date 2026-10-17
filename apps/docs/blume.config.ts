import { defineConfig } from 'blume';
import { orama } from 'blume/search';

const repositoryUrl = 'https://github.com/yangshun/langnostic';

export default defineConfig({
  title: 'Langnostic',
  description:
    'Translate FormatJS message catalogs and Markdown documents with AI, using your own provider and keeping translations in your repository.',
  basePath: '/docs',
  deployment: { site: 'https://langnostic.com' },
  content: { root: 'content/docs' },
  logo: { image: '/logo.svg', text: 'Langnostic', href: '/' },
  theme: {
    accent: { light: '#7452ab', dark: '#c9a9f3' },
    background: { light: '#f9f7f2', dark: '#121018' },
    mode: 'system',
  },
  navigation: {
    actions: [
      { label: 'Docs', href: '/docs' },
      { label: 'GitHub', href: repositoryUrl },
    ],
    repo: repositoryUrl,
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
      keywords:
        'translation, i18n, internationalization, AI translation, localization, React, MDX, JSON',
    },
  },
});
