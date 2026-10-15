import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, expect, test, vi } from 'vite-plus/test';

import Config from './index';
import type { DeclarativeConfigType } from './types';

let directory: string;
const pluginSource = `
await Promise.resolve();
export default async function createPlugin(options) {
  return {
    type: 'test', stringsPerRequest: 10, options,
    async trackFiles() {},
    async getTranslationStrings() { return []; },
    async onTranslationBatchComplete() {},
  };
}
export { createPlugin };
export const invalid = 123;
export function fail() { throw Error('Factory failed'); }
export function failWithString() { throw 'Factory rejected'; }
export function invalidPlugin() { return { type: 'broken' }; }
`;
const providerSource = `
export function createProvider(options) {
  return {
    languageModel(modelId) {
      return {
        specificationVersion: 'v4', provider: 'test', modelId, options,
        async doGenerate() {},
      };
    },
  };
}
export function nullProvider() { return null; }
export function undefinedProvider() {}
export function invalidProvider() { return {}; }
export function invalidModel() { return { languageModel() { return {}; } }; }
`;

beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'langnostic-config-'));
  await fs.writeFile(path.join(directory, 'plugin.mjs'), pluginSource);
  await fs.writeFile(path.join(directory, 'provider.mjs'), providerSource);
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await fs.rm(directory, { recursive: true, force: true });
});

function configuration(): DeclarativeConfigType {
  return {
    version: 1,
    ai: {
      provider: { module: './provider.mjs', export: 'createProvider' },
      model: 'new-model-without-a-langnostic-update',
    },
    localeConfig: { source: 'en', target: ['fr'] },
    groups: [
      {
        name: 'app',
        plugin: './plugin.mjs',
        paths: [{ source: 'en.json', target: '{locale}.json' }],
      },
    ],
  };
}

async function load(
  config: unknown = configuration(),
  filename = 'langnostic.json',
) {
  await fs.writeFile(path.join(directory, filename), JSON.stringify(config));
  return Config.load(directory);
}

test.each(['langnostic.json', 'langnostic.config.json'])(
  'loads relative ESM factories, arbitrary models and independent plugin instances from %s',
  async (filename) => {
    const input = configuration();
    input.groups.push({ ...input.groups[0], name: 'other' });
    const result = await load(input, filename);
    expect(result.ai.model).toMatchObject({
      provider: 'test',
      modelId: input.ai.model,
    });
    expect(result.groups[0].plugin.type).toBe('test');
    expect(result.groups[0].plugin).not.toBe(result.groups[1].plugin);
    expect(await result.groups[0].plugin.getTranslationStrings()).toEqual([]);
  },
);

test('resolves import-only packages from the configuration directory and supports named exports', async () => {
  const packageDirectory = path.join(
    directory,
    'node_modules',
    'custom-plugin',
  );
  await fs.mkdir(packageDirectory, { recursive: true });
  await fs.writeFile(
    path.join(packageDirectory, 'package.json'),
    JSON.stringify({
      name: 'custom-plugin',
      type: 'module',
      exports: { import: './index.mjs', require: './unavailable.cjs' },
    }),
  );
  await fs.writeFile(path.join(packageDirectory, 'index.mjs'), pluginSource);
  const input = configuration();
  input.groups[0].plugin = {
    module: 'custom-plugin',
    export: 'createPlugin',
    options: { frontmatterExcludedKeys: ['slug'] },
  };
  const result = await load(input);
  expect(result.groups[0].plugin).toMatchObject({
    options: { frontmatterExcludedKeys: ['slug'] },
  });
});

test('resolves nested environment references in provider, plugin and generation options', async () => {
  vi.stubEnv('LANGNOSTIC_CONFIG_KEY', 'test-secret');
  vi.stubEnv('LANGNOSTIC_CONFIG_EMPTY', '');
  const input = configuration();
  input.ai.provider!.options = {
    apiKey: { env: 'LANGNOSTIC_CONFIG_KEY' },
    headers: { Authorization: { env: 'LANGNOSTIC_CONFIG_KEY' } },
  };
  input.ai.providerOptions = {
    test: { token: { env: 'LANGNOSTIC_CONFIG_KEY' }, custom: true },
  };
  input.ai.temperature = 0.2;
  input.ai.topP = 0.9;
  input.groups[0].plugin = {
    module: './plugin.mjs',
    options: {
      values: [null, 1, true, { env: 'LANGNOSTIC_CONFIG_EMPTY' }],
      nested: { key: { env: 'LANGNOSTIC_CONFIG_KEY' } },
    },
  };
  const result = await load(input);
  expect(result.ai.model).toMatchObject({
    options: {
      apiKey: 'test-secret',
      headers: { Authorization: 'test-secret' },
    },
  });
  expect(result.ai).toMatchObject({
    temperature: 0.2,
    topP: 0.9,
    providerOptions: { test: { token: 'test-secret', custom: true } },
  });
  expect(result.groups[0].plugin).toMatchObject({
    options: { values: [null, 1, true, ''], nested: { key: 'test-secret' } },
  });
});

test('keeps model strings available for AI SDK default-provider routing', async () => {
  const input = configuration();
  delete input.ai.provider;
  const result = await load(input);
  expect(result.ai.model).toBe(input.ai.model);
});

test.each([
  [
    { env: 'LANGNOSTIC_CONFIG_MISSING' },
    'Environment variable LANGNOSTIC_CONFIG_MISSING is not set',
  ],
  [{ env: '' }, 'Expected a non-empty environment variable name'],
  [{ env: 123 }, 'Expected a non-empty environment variable name'],
])(
  'reports invalid environment references at their option path: %j',
  async (reference, message) => {
    vi.stubEnv('LANGNOSTIC_CONFIG_MISSING', undefined);
    const input = configuration();
    input.groups[0].plugin = {
      module: './plugin.mjs',
      options: { token: reference },
    };
    await expect(load(input)).rejects.toThrow(
      `groups.0.plugin.options.token: ${message}`,
    );
  },
);

test.each([
  ['missing-plugin-package', 'Cannot load "missing-plugin-package"'],
  ['./missing.mjs', 'Cannot load "./missing.mjs"'],
  [
    { module: './plugin.mjs', export: 'missing' },
    'Export "missing" must be a factory function',
  ],
  [
    { module: './plugin.mjs', export: 'invalid' },
    'Export "invalid" must be a factory function',
  ],
  [{ module: './plugin.mjs', export: 'fail' }, 'Factory failed'],
  [{ module: './plugin.mjs', export: 'failWithString' }, 'Factory rejected'],
] as const)(
  'reports module and factory failures with their configuration field: %j',
  async (reference, message) => {
    const input = configuration();
    input.groups[0].plugin = reference;
    await expect(load(input)).rejects.toThrow('groups.0.plugin:');
    await expect(load(input)).rejects.toThrow(message);
  },
);

test.each(['nullProvider', 'undefinedProvider', 'invalidProvider'])(
  'rejects a factory that does not return a provider: %s',
  async (exportName) => {
    const input = configuration();
    input.ai.provider!.export = exportName;
    await expect(load(input)).rejects.toThrow(
      'ai.provider: Factory must return an AI SDK provider with languageModel()',
    );
  },
);

test('validates the provider model and plugin lifecycle before translation', async () => {
  const input = configuration();
  input.ai.provider!.export = 'invalidModel';
  await expect(load(input)).rejects.toThrow('ai.model');
  input.ai.provider!.export = 'createProvider';
  input.groups[0].plugin = { module: './plugin.mjs', export: 'invalidPlugin' };
  await expect(load(input)).rejects.toThrow('groups.0.plugin');
});

test.each([
  [{ version: 2 }, 'version'],
  [{ version: undefined }, 'version'],
  [{ unexpected: true }, 'Unrecognized key'],
  [{ ai: { model: '' } }, 'ai.model'],
  [{ ai: { model: 'test', provider: { module: '' } } }, 'ai.provider.module'],
  [
    {
      ai: { model: 'test', provider: { module: './provider.mjs', export: '' } },
    },
    'ai.provider.export',
  ],
  [{ ai: { model: 'test', temperature: 'high' } }, 'ai.temperature'],
  [
    {
      ai: {
        model: 'test',
        provider: { module: './provider.mjs', options: [] },
      },
    },
    'ai.provider.options',
  ],
])(
  'rejects malformed declarative configuration before loading factories: %j',
  async (overrides, message) => {
    await expect(load({ ...configuration(), ...overrides })).rejects.toThrow(
      message,
    );
  },
);

test('rejects duplicate declarative group names', async () => {
  const input = configuration();
  input.groups.push({ ...input.groups[0] });
  await expect(load(input)).rejects.toThrow(
    'Duplicate translation group name: app',
  );
});

test('supports configuration directories containing URL-special characters', async () => {
  const original = directory;
  directory = path.join(directory, 'project #1');
  await fs.mkdir(directory);
  try {
    const input = configuration();
    input.ai.provider = { module: '../provider.mjs', export: 'createProvider' };
    input.groups[0].plugin = '../plugin.mjs';
    expect((await load(input)).groups[0].plugin.type).toBe('test');
  } finally {
    directory = original;
  }
});
