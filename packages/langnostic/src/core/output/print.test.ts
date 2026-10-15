import { afterEach, beforeEach, expect, test, vi } from 'vite-plus/test';

import { TranslationGroupBatch } from '../runner/translation-group-batch';
import type { TranslationGroups } from '../types';

vi.mock('log-update', () => ({ default: vi.fn() }));
import logUpdate from 'log-update';

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

test('formats missing and elapsed durations', async () => {
  const { formatDuration } = await import('./print');
  expect(formatDuration(null)).toBe('');
  expect(formatDuration(0)).toBe('0.0s');
  expect(formatDuration(1250)).toBe('1.3s');
});

test('renders queued, translating, successful and failed batches and summary', async () => {
  const { printGroupStatus } = await import('./print');
  const { batchStatusSymbol } = await import('./spinner-frames');
  const string = {
    batchId: './file',
    id: 'a',
    source: { locale: 'en', string: 'Hello' },
    targets: ['fr'],
  };
  const queued = new TranslationGroupBatch('./queued', [string]);
  const active = new TranslationGroupBatch('./active', [string, string]);
  active.startTranslating();
  const complete = new TranslationGroupBatch('./complete', [string]);
  complete.startTranslating();
  complete.addTranslations([
    { ...string, targets: [{ locale: 'fr', string: 'Bonjour' }] },
  ]);
  complete.markSuccess();
  const failed = new TranslationGroupBatch('./failed', []);
  failed.addError(Error('failed'));
  const groups: TranslationGroups = new Map([
    [
      'app',
      {
        groupId: 'app',
        batches: new Map(
          [queued, active, complete, failed].map((batch) => [
            batch.batchId,
            batch,
          ]),
        ),
        stringsPerRequest: 10,
        plugin: {
          type: 'test',
          stringsPerRequest: 10,
          trackFiles: async () => {},
          getTranslationStrings: async () => [],
          onTranslationBatchComplete: async () => {},
        },
      },
    ],
  ]);
  expect(batchStatusSymbol('translating')).toBe('⠋');
  vi.advanceTimersByTime(80);
  expect(batchStatusSymbol('translating')).toBe('⠙');
  expect(vi.getTimerCount()).toBe(0);
  printGroupStatus(groups);
  const printed = vi.mocked(logUpdate).mock.calls.slice(-1)[0]?.[0];
  expect(printed).toContain('[app]');
  expect(printed).toContain('(1 string)');
  expect(printed).toContain('(2 strings)');
  expect(printed).toContain('1 successful');
  expect(printed).toContain('1 failed');
  expect(printed).toContain('queued');
  expect(printed).toContain('complete');
  expect(printed).toContain('failed');
  expect(printed).toContain('4 total');
  expect(printed).toContain('Duration:');
  printGroupStatus(groups, { showSummary: false });
  expect(vi.mocked(logUpdate).mock.calls.slice(-1)[0]?.[0]).not.toContain(
    'Batches:',
  );
});
