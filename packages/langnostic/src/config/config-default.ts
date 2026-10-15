// TODO: Define as a `.ts` file and bundle into the package as a string during build time
export const configFileDefault = `
import FormatJSPlugin from '@langnostic/plugin-formatjs';
import type { ConfigType } from 'langnostic';

export default {
  ai: {
    provider: 'openai',
    model: 'gpt-6.1-sol',
  },
  groups: [
    {
      name: 'app-strings',
      paths: [
        {
          source: './src/locales/en-US.json',
          target: './src/locales/{locale}.json',
        },
      ],
      plugin: FormatJSPlugin(),
    },
  ],
  localeConfig: {
    source: 'en-US',
    target: ['zh-CN'],
  },
} satisfies ConfigType;
`;

export const configFileJSONDefault = JSON.stringify(
  {
    version: 1,
    ai: {
      provider: 'openai',
      model: 'gpt-6.1-sol',
    },
    groups: [
      {
        name: 'app-strings',
        paths: [
          {
            source: './src/locales/en-US.json',
            target: './src/locales/{locale}.json',
          },
        ],
        plugin: '@langnostic/plugin-formatjs',
      },
    ],
    localeConfig: {
      source: 'en-US',
      target: ['zh-CN'],
    },
  },
  null,
  2,
);
