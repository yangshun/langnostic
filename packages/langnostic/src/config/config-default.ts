// TODO: Define as a `.ts` file and bundle into the package as a string during build time
export const configFileDefault = `
import { openai } from '@ai-sdk/openai';
import FormatJSPlugin from '@langnostic/plugin-formatjs';
import type { ConfigType } from 'langnostic';

export default {
  ai: {
    model: openai('gpt-6.1-sol'),
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
      provider: {
        module: '@ai-sdk/openai',
        export: 'createOpenAI',
      },
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
