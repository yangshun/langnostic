import JsonPlugin from '@langnostic/plugin-json';
import MdxPlugin from '@langnostic/plugin-mdx';
import type { ConfigType } from 'langnostic';

export default {
  ai: {
    provider: 'google',
  },
  localeConfig: {
    source: 'en-US',
    target: ['zh-CN', 'pt-BR'],
  },
  groups: [
    {
      name: 'app',
      plugin: JsonPlugin(),
      paths: [
        {
          source: './src/locales/en-US.json',
          target: './src/locales/{locale}.json',
        },
      ],
    },
    {
      name: 'blog',
      plugin: MdxPlugin(),
      paths: [
        {
          source: './src/blog/**/en-US.mdx',
          target: './src/blog/**/{locale}.mdx',
        },
      ],
    },
    {
      name: 'questions',
      plugin: MdxPlugin(),
      paths: [
        {
          source: './src/questions/*/writeups/en-US/**/*.mdx',
          target: './src/questions/*/writeups/{locale}/**/*.mdx',
        },
      ],
    },
  ],
} satisfies ConfigType;
