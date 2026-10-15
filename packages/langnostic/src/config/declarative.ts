import { pathToFileURL } from 'node:url';

import { resolve } from 'import-meta-resolve';

import { resolveAI, type ResolvedConfig } from './ai';
import { resolveEnvironment } from './environment';
import type { ModuleReference } from './types';
import { validateConfig, validateDeclarativeConfig } from './validate';

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
): Promise<ResolvedConfig> {
  const config = validateDeclarativeConfig(value);
  const parentURL = pathToFileURL(filepath).href;
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
  const validated = validateConfig({
    ...config,
    groups,
  });
  return { ...validated, ai: resolveAI(validated.ai) };
}
