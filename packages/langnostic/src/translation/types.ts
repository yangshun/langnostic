import type { generateText, LanguageModel } from 'ai';

export type TranslationAI = Readonly<{
  model: Exclude<LanguageModel, string>;
  providerOptions?: Parameters<typeof generateText>[0]['providerOptions'];
  temperature?: Parameters<typeof generateText>[0]['temperature'];
  topP?: Parameters<typeof generateText>[0]['topP'];
}>;
