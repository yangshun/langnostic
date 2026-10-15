import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogle } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

import type { TranslationAI } from '@/translation/types';

import { resolveEnvironment } from './environment';
import { createProviderFetch } from './parameters';
import type { AIConfig, ConfigType, ConfigValue } from './types';

export type ResolvedConfig = Omit<ConfigType, 'ai'> & { ai: TranslationAI };

export function resolveAI(config: AIConfig): TranslationAI {
  const options = {
    apiKey:
      config.apiKey === undefined
        ? undefined
        : (resolveEnvironment(config.apiKey, 'ai.apiKey') as string),
    baseURL: config.baseURL,
    headers:
      config.headers === undefined
        ? undefined
        : (resolveEnvironment(config.headers, 'ai.headers') as Record<
            string,
            string
          >),
    fetch: createProviderFetch(
      config.provider,
      config.parameters === undefined
        ? undefined
        : (resolveEnvironment(config.parameters, 'ai.parameters') as Record<
            string,
            ConfigValue
          >),
    ),
  };
  let model: TranslationAI['model'];
  switch (config.provider) {
    case 'openai':
      model = createOpenAI(options).responses(config.model);
      break;
    case 'anthropic':
      model = createAnthropic(options).languageModel(config.model);
      break;
    case 'google':
      model = createGoogle(options).languageModel(config.model);
      break;
    case 'openai-compatible':
      model = createOpenAICompatible({
        ...options,
        name: 'custom',
        baseURL: config.baseURL!,
        supportsStructuredOutputs: true,
      }).languageModel(config.model);
      break;
  }
  return {
    model,
    temperature: config.temperature,
    topP: config.topP,
  };
}
