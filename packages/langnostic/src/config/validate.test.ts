import { expect, test } from 'vite-plus/test';

import type { ConfigType } from './types';
import { validateConfig } from './validate';

function config(): ConfigType {
  return {
    ai: { model: 'test/model' },
    localeConfig: { source: 'en-US', target: ['fr', 'de'] },
    groups: [
      {
        name: 'app',
        paths: [{ source: 'en.json', target: '{locale}.json' }],
        plugin: {
          type: 'test',
          stringsPerRequest: 10,
          trackFiles: async () => {},
          getTranslationStrings: async () => [],
          onTranslationBatchComplete: async () => {},
        },
      },
    ],
  };
}

test.each([
  [null, 'config'],
  [{ ...config(), ai: {} }, 'ai.model'],
  [{ ...config(), ai: { model: {} } }, 'ai.model'],
  [{ ...config(), concurrencyLimit: 0 }, 'concurrencyLimit'],
  [{ ...config(), concurrencyLimit: -1 }, 'concurrencyLimit'],
  [{ ...config(), concurrencyLimit: 1.5 }, 'concurrencyLimit'],
  [{ ...config(), concurrencyLimit: Infinity }, 'concurrencyLimit'],
  [
    { ...config(), localeConfig: { source: 'en', target: [] } },
    'localeConfig.target',
  ],
  [
    { ...config(), localeConfig: { source: 'en', target: ['en'] } },
    'localeConfig.target',
  ],
  [
    { ...config(), localeConfig: { source: 'en', target: ['fr', 'FR'] } },
    'localeConfig.target',
  ],
  [
    { ...config(), localeConfig: { source: '../en', target: ['fr'] } },
    'localeConfig.source',
  ],
  [
    { ...config(), groups: [{ ...config().groups[0], name: '' }] },
    'groups.0.name',
  ],
  [
    { ...config(), groups: [{ ...config().groups[0], paths: [] }] },
    'groups.0.paths',
  ],
  [
    {
      ...config(),
      groups: [
        { ...config().groups[0], paths: [{ source: '', target: 'fr.json' }] },
      ],
    },
    'groups.0.paths.0.source',
  ],
  [
    { ...config(), groups: [{ ...config().groups[0], stringsPerRequest: 0 }] },
    'groups.0.stringsPerRequest',
  ],
  [
    {
      ...config(),
      groups: [
        {
          ...config().groups[0],
          plugin: { ...config().groups[0].plugin, stringsPerRequest: 0 },
        },
      ],
    },
    'groups.0.plugin',
  ],
  [
    {
      ...config(),
      groups: [
        {
          ...config().groups[0],
          plugin: { ...config().groups[0].plugin, trackFiles: 'invalid' },
        },
      ],
    },
    'groups.0.plugin',
  ],
  [
    {
      ...config(),
      groups: [
        {
          ...config().groups[0],
          plugin: {
            ...config().groups[0].plugin,
            onTranslationStart: 'invalid',
          },
        },
      ],
    },
    'groups.0.plugin',
  ],
])(
  'rejects invalid configuration with an actionable field path: %s',
  (input, field) => {
    expect(() => validateConfig(input)).toThrow(field);
  },
);

test('rejects duplicate group names', () => {
  const input = config();
  input.groups.push({ ...input.groups[0] });
  expect(() => validateConfig(input)).toThrow(
    'Duplicate translation group name: app',
  );
});

test('preserves provider and plugin instances, options and group overrides', () => {
  class Model {
    specificationVersion = 'v4';
    provider = 'test';
    modelId = 'model';
    async doGenerate() {}
  }
  const input = {
    ...config(),
    concurrencyLimit: 2,
    ai: {
      model: new Model(),
      providerOptions: { test: { custom: true } },
      temperature: 0.2,
    },
  };
  input.groups[0].localeConfig = { source: 'en', target: ['es'] };
  input.groups[0].stringsPerRequest = 1;
  const validated = validateConfig(input);
  expect(validated).toBe(input);
  expect(validated.ai.model).toBe(input.ai.model);
  expect(validated.groups[0].plugin).toBe(input.groups[0].plugin);
  expect(Object.getPrototypeOf(validated.ai.model)).toBe(Model.prototype);
  expect(validated.ai.providerOptions).toEqual({ test: { custom: true } });
});
