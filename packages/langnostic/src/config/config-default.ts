// TODO: Define as a `.ts` file and bundle into the package as a string during build time
export const configFileDefault = `
import { openai } from '@ai-sdk/openai';
import JsonPlugin from '@langnostic/plugin-json';
import type { ConfigType } from 'langnostic';

export default {
  ai: {
    model: openai('gpt-5'),
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
      plugin: JsonPlugin(),
    },
  ],
  localeConfig: {
    source: 'en-US',
    target: ['zh-CN'],
  },
} satisfies ConfigType;
`;
