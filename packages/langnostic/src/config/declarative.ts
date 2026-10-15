import { pathToFileURL } from 'node:url';

import { resolve } from 'import-meta-resolve';

import type { ConfigType, ConfigValue, ModuleReference } from './types';
import { validateConfig, validateDeclarativeConfig } from './validate';

function resolveEnvironment(value: ConfigValue, field: string): ConfigValue {
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      resolveEnvironment(item, `${field}.${index}`),
    );
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Object.keys(value).length === 1 && 'env' in value) {
    if (typeof value.env !== 'string' || value.env.trim() === '') {
      throw new Error(
        `${field}: Expected a non-empty environment variable name`,
      );
    }
    const resolved = process.env[value.env];
    if (resolved === undefined) {
      throw new Error(`${field}: Environment variable ${value.env} is not set`);
    }
    return resolved;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      resolveEnvironment(item, `${field}.${key}`),
    ]),
  );
}

async function loadFactory(
  reference: string | ModuleReference,
  parentURL: string,
  field: string,
): Promise<unknown> {
  const descriptor =
    typeof reference === 'string' ? { module: reference } : reference;
  const exportName = descriptor.export ?? 'default';
  const options =
    descriptor.options === undefined
      ? undefined
      : resolveEnvironment(descriptor.options, `${field}.options`);
  try {
    const module = await import(resolve(descriptor.module, parentURL));
    const factory = module[exportName];
    if (typeof factory !== 'function') {
      throw new Error(`Export "${exportName}" must be a factory function`);
    }
    return await factory(options);
  } catch (error) {
    throw Object.assign(
      new Error(
        `${field}: Cannot load "${descriptor.module}": ${error instanceof Error ? error.message : String(error)}`,
      ),
      { cause: error },
    );
  }
}

export async function loadDeclarativeConfig(
  value: unknown,
  filepath: string,
): Promise<ConfigType> {
  const config = validateDeclarativeConfig(value);
  const parentURL = pathToFileURL(filepath).href;
  const { provider: providerReference, ...ai } = config.ai;
  let model: unknown = ai.model;
  if (providerReference !== undefined) {
    const provider = (await loadFactory(
      providerReference,
      parentURL,
      'ai.provider',
    )) as { languageModel?: unknown } | null;
    if (typeof provider?.languageModel !== 'function') {
      throw new Error(
        'ai.provider: Factory must return an AI SDK provider with languageModel()',
      );
    }
    model = await provider.languageModel(ai.model);
  }
  const groups = await Promise.all(
    config.groups.map(async (group, index) => ({
      ...group,
      plugin: await loadFactory(
        group.plugin,
        parentURL,
        `groups.${index}.plugin`,
      ),
    })),
  );
  return validateConfig({
    ...config,
    ai: {
      ...ai,
      model,
      providerOptions:
        ai.providerOptions === undefined
          ? undefined
          : resolveEnvironment(ai.providerOptions, 'ai.providerOptions'),
    },
    groups,
  });
}
