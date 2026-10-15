import { z } from 'zod';

import type { LangnosticPlugin } from '@/core/types';

import type { ConfigType, DeclarativeConfigType } from './types';

const positiveInteger = z.number().int().positive();
const nonemptyString = z.string().trim().min(1);
const callable = z.custom(
  (value) => typeof value === 'function',
  'Expected a function',
);
const environmentReference = z.strictObject({ env: nonemptyString });
const aiSchema = z
  .strictObject(
    {
      provider: z.enum(['openai', 'anthropic', 'google', 'openai-compatible'], {
        error:
          'Set provider to openai, anthropic, google, or openai-compatible. Provider module/export references and implicit default-provider routing are no longer supported.',
      }),
      model: z
        .string({
          error:
            'Expected a model ID string. Replace AI SDK model objects with provider and model strings.',
        })
        .trim()
        .min(1),
      apiKey: z.union([z.string(), environmentReference]).optional(),
      baseURL: z.url({ protocol: /^https?$/ }).optional(),
      headers: z
        .record(z.string(), z.union([z.string(), environmentReference]))
        .optional(),
      parameters: z.record(z.string(), z.json()).optional(),
      temperature: z.number().optional(),
      topP: z.number().optional(),
    },
    {
      error:
        'Unsupported AI setting. Replace SDK providerOptions with parameters containing native API request fields.',
    },
  )
  .refine(
    (ai) => ai.provider !== 'openai-compatible' || ai.baseURL !== undefined,
    { path: ['baseURL'], message: 'baseURL is required for openai-compatible' },
  );
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
const groupSchema = z.object({
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
});
const configSchema = z.object({
  ai: aiSchema,
  concurrencyLimit: positiveInteger.optional(),
  localeConfig: localeConfigSchema,
  groups: z.array(groupSchema),
});

const moduleReferenceSchema = z.strictObject({
  module: nonemptyString,
  export: nonemptyString.optional(),
  options: z.record(z.string(), z.json()).optional(),
});
const declarativeConfigSchema = configSchema
  .extend({
    version: z.literal(1),
    groups: z.array(
      groupSchema
        .extend({
          plugin: z.union([nonemptyString, moduleReferenceSchema]),
        })
        .strict(),
    ),
  })
  .strict();

function validate<T extends { groups: Array<{ name: string }> }>(
  schema: z.ZodType<T>,
  value: unknown,
): T {
  const result = schema.safeParse(value);
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

  return result.data;
}

export function validateConfig(value: unknown): ConfigType {
  const validated = validate(configSchema, value);
  // Preserve plugin instances, including their prototypes and options.
  return { ...(value as ConfigType), ai: validated.ai };
}

export function validateDeclarativeConfig(
  value: unknown,
): DeclarativeConfigType {
  return validate(declarativeConfigSchema, value);
}
