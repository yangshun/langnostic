import { z } from 'zod';

import type { LangnosticPlugin, TranslationAI } from '@/core/types';

import type { ConfigType } from './types';

const positiveInteger = z.number().int().positive();
const nonemptyString = z.string().trim().min(1);
const callable = z.custom(
  (value) => typeof value === 'function',
  'Expected a function',
);
const modelSchema = z.union([
  nonemptyString,
  z.object({
    specificationVersion: nonemptyString,
    provider: nonemptyString,
    modelId: nonemptyString,
    doGenerate: callable,
  }),
]);
const pluginSchema = z.object({
  type: nonemptyString,
  stringsPerRequest: positiveInteger,
  trackFiles: callable,
  getTranslationStrings: callable,
  onTranslationBatchComplete: callable,
  getInstructions: callable.optional(),
  onTranslationStart: callable.optional(),
});
const locale = z
  .string()
  .regex(/^[a-z]{2,8}(?:-[a-z0-9]{1,8})*$/i, 'Expected a locale such as en-US');
const localeConfigSchema = z
  .object({
    source: locale,
    target: z.array(locale).min(1),
  })
  .refine(
    ({ source, target }) =>
      new Set([source, ...target].map((value) => value.toLowerCase())).size ===
      target.length + 1,
    {
      path: ['target'],
      message:
        'Target locales must be unique and differ from the source locale',
    },
  );
const configSchema = z.object({
  ai: z.object({
    model: z.custom<TranslationAI['model']>(
      (value) => modelSchema.safeParse(value).success,
      'Expected a model ID or an AI SDK language model',
    ),
  }),
  concurrencyLimit: positiveInteger.optional(),
  localeConfig: localeConfigSchema,
  groups: z.array(
    z.object({
      name: nonemptyString,
      localeConfig: localeConfigSchema.optional(),
      paths: z
        .array(z.object({ source: nonemptyString, target: nonemptyString }))
        .min(1),
      stringsPerRequest: positiveInteger.optional(),
      plugin: z.custom<LangnosticPlugin>(
        (value) => pluginSchema.safeParse(value).success,
        'Expected a plugin with a type, positive integer stringsPerRequest, and callable lifecycle methods',
      ),
    }),
  ),
});

export function validateConfig(value: unknown): ConfigType {
  const result = configSchema.safeParse(value);
  if (!result.success) {
    throw new Error(
      `Invalid Langnostic configuration:\n${result.error.issues.map((issue) => `${issue.path.join('.') || 'config'}: ${issue.message}`).join('\n')}`,
    );
  }

  const names = new Set<string>();
  for (const group of result.data.groups) {
    if (names.has(group.name)) {
      throw new Error(`Duplicate translation group name: ${group.name}`);
    }
    names.add(group.name);
  }

  // Preserve provider and plugin instances, including their prototypes and options.
  return value as ConfigType;
}
