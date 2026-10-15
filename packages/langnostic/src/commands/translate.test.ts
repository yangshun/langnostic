import { afterEach, beforeEach, expect, test, vi } from 'vite-plus/test';

import type { ConfigType } from '@/config/types';
import type { TranslationStringArg } from '@/core/types';

const mocks = vi.hoisted(() => ({
  config: {} as ConfigType,
  print: vi.fn(),
  generate: vi.fn(),
  expand: vi.fn(),
}));
vi.mock('@/config', () => ({
  default: class {
    config = mocks.config;
  },
}));
vi.mock('@/core', () => ({ expandTargetPaths: mocks.expand }));
vi.mock('@/core/output/print', () => ({ printGroupStatus: mocks.print }));
vi.mock('@/translation/generate', () => ({ generate: mocks.generate }));
import { translate } from './translate';

const strings: TranslationStringArg[] = ['one', 'two', 'three'].map((id) => ({
  batchId: './locales/en.json',
  id,
  source: { locale: 'en', string: id },
  targets: ['fr'],
}));
const file = {
  source: { locale: 'en', path: './locales/en.json' },
  targets: [{ locale: 'fr', path: './locales/fr.json' }],
};
const exited = Error('process exited');

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.spyOn(process, 'exit').mockImplementation(() => {
    throw exited;
  });
  vi.spyOn(console, 'info').mockImplementation(() => {});
  mocks.expand.mockResolvedValue([file]);
  mocks.config = {
    ai: { model: 'test' },
    localeConfig: { source: 'en', target: ['fr'] },
    groups: [
      {
        name: 'app',
        paths: [{ source: 'en.json', target: '{locale}.json' }],
        plugin: {
          type: 'test',
          stringsPerRequest: 2,
          trackFiles: vi.fn().mockResolvedValue(undefined),
          getTranslationStrings: vi.fn().mockResolvedValue(strings),
          onTranslationStart: vi.fn().mockResolvedValue(undefined),
          onTranslationBatchComplete: vi.fn().mockResolvedValue(undefined),
          getInstructions: vi.fn().mockResolvedValue('Preserve markup'),
        },
      },
    ],
  };
  mocks.generate.mockImplementation(async (_ai, job) =>
    job.strings.map((s: TranslationStringArg) => ({
      ...s,
      targets: [{ locale: 'fr', string: `translated ${s.id}` }],
    })),
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

test('discovers files, chunks requests and completes each batch once with all translations', async () => {
  await expect(translate({ debug: true })).rejects.toBe(exited);
  const plugin = mocks.config.groups[0].plugin;
  expect(mocks.expand).toHaveBeenCalledWith(
    mocks.config.localeConfig,
    mocks.config.groups[0].paths[0],
  );
  expect(plugin.trackFiles).toHaveBeenCalledWith([file]);
  expect(plugin.onTranslationStart).toHaveBeenCalledOnce();
  expect(mocks.generate).toHaveBeenCalledTimes(2);
  expect(mocks.generate).toHaveBeenNthCalledWith(
    1,
    mocks.config.ai,
    expect.objectContaining({
      jobId: 'app-locales#en.json-0',
      strings: strings.slice(0, 2),
    }),
    { debug: true, instructions: 'Preserve markup' },
  );
  expect(plugin.onTranslationBatchComplete).toHaveBeenCalledOnce();
  expect(plugin.onTranslationBatchComplete).toHaveBeenCalledWith(
    strings.map((s) => ({
      ...s,
      targets: [{ locale: 'fr', string: `translated ${s.id}` }],
    })),
  );
  expect(vi.getTimerCount()).toBe(0);
});

test('honors group overrides and optional instructions and refreshes progress', async () => {
  const group = mocks.config.groups[0];
  group.localeConfig = { source: 'en', target: ['de'] };
  group.stringsPerRequest = 1;
  delete group.plugin.getInstructions;
  delete group.plugin.onTranslationStart;
  mocks.config.concurrencyLimit = 1;
  mocks.generate.mockImplementation(async (_ai, job) => {
    await vi.advanceTimersByTimeAsync(100);
    return job.strings.map((s: TranslationStringArg) => ({
      ...s,
      targets: [{ locale: 'de', string: s.id }],
    }));
  });
  await expect(translate({})).rejects.toBe(exited);
  expect(mocks.expand).toHaveBeenCalledWith(group.localeConfig, group.paths[0]);
  expect(mocks.generate).toHaveBeenCalledTimes(3);
  expect(mocks.generate.mock.calls[0][2]).toEqual({
    debug: false,
    instructions: '',
  });
  expect(mocks.print.mock.calls.length).toBeGreaterThan(1);
});

test('exits without generating when no strings need translation', async () => {
  vi.mocked(
    mocks.config.groups[0].plugin.getTranslationStrings,
  ).mockResolvedValue([]);
  await expect(translate({})).rejects.toBe(exited);
  expect(console.info).toHaveBeenCalledWith(
    'Nothing to translate. Terminating.',
  );
  expect(mocks.generate).not.toHaveBeenCalled();
  expect(
    mocks.config.groups[0].plugin.onTranslationStart,
  ).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});

test('dry runs show pending batches without calling the model or writing translations', async () => {
  await expect(translate({ dryRun: true })).rejects.toBe(exited);
  expect(mocks.print).toHaveBeenCalledWith(expect.any(Map), {
    showSummary: false,
  });
  expect(mocks.generate).not.toHaveBeenCalled();
  expect(
    mocks.config.groups[0].plugin.onTranslationStart,
  ).not.toHaveBeenCalled();
  expect(
    mocks.config.groups[0].plugin.onTranslationBatchComplete,
  ).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

test('dry runs skip maintenance even when there are no pending translations', async () => {
  const plugin = mocks.config.groups[0].plugin;
  vi.mocked(plugin.getTranslationStrings).mockResolvedValue([]);
  await expect(translate({ dryRun: true })).rejects.toBe(exited);
  expect(plugin.onTranslationStart).not.toHaveBeenCalled();
  expect(mocks.generate).not.toHaveBeenCalled();
});

test('reports failed generation and continues with other batches', async () => {
  const plugin = mocks.config.groups[0].plugin;
  vi.mocked(plugin.getTranslationStrings).mockResolvedValue([
    strings[0],
    { ...strings[1], batchId: 'other' },
  ]);
  mocks.generate.mockRejectedValueOnce(Error('provider failed'));
  await expect(translate({})).rejects.toBe(exited);
  const groups = mocks.print.mock.calls.slice(-1)[0]?.[0];
  expect(groups.get('app').batches.get(strings[0].batchId).status).toBe(
    'error',
  );
  expect(groups.get('app').batches.get('other').status).toBe('success');
  expect(plugin.onTranslationBatchComplete).toHaveBeenCalledOnce();
});
