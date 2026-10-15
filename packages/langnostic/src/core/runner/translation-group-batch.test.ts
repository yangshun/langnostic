import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

import type { TranslationStringArg, TranslationStringResult } from '../types';
import { TranslationGroupBatch } from './translation-group-batch';

const strings: TranslationStringArg[] = ['a', 'b'].map((id) => ({
  batchId: 'file',
  id,
  source: { locale: 'en', string: id },
  targets: ['fr'],
}));
const results: TranslationStringResult[] = strings.map((string) => ({
  ...string,
  targets: [{ locale: 'fr', string: `translated ${string.id}` }],
}));

afterEach(() => vi.useRealTimers());

describe('TranslationGroupBatch', () => {
  test('tracks queued, partial and completed batches with stable elapsed time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const batch = new TranslationGroupBatch('file', strings);
    expect(batch.batchId).toBe('file');
    expect(batch.strings).toEqual(strings);
    expect(batch.translations).toEqual([]);
    expect(batch.status).toBe('queued');
    expect(batch.duration).toBeNull();
    expect(batch.readyToWrite).toBe(false);
    expect(() => batch.markSuccess()).toThrow('all translations are ready');
    expect(() => batch.addTranslations(results)).toThrow('not translating');
    batch.startTranslating();
    vi.advanceTimersByTime(100);
    batch.startTranslating();
    expect(batch.duration).toBe(100);
    batch.addTranslations([results[0]]);
    expect(batch.status).toBe('translating');
    vi.advanceTimersByTime(200);
    batch.addTranslations([results[1]]);
    expect(batch.status).toBe('translating');
    expect(batch.readyToWrite).toBe(true);
    batch.markSuccess();
    expect(batch.status).toBe('success');
    expect(batch.translations).toEqual(results);
    vi.advanceTimersByTime(100);
    expect(batch.duration).toBe(300);
    batch.addError(Error('late error'));
    expect(batch.status).toBe('error');
    expect(batch.duration).toBe(400);
  });

  test('records errors before and during translation', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const queued = new TranslationGroupBatch('file', strings);
    queued.addError(Error('failed'));
    expect(queued.status).toBe('error');
    queued.addError('again');
    expect(queued.errors.map((error) => error.message)).toEqual([
      'failed',
      'again',
    ]);
    expect(queued.duration).toBeNull();
    const started = new TranslationGroupBatch('file', strings);
    started.startTranslating();
    vi.advanceTimersByTime(50);
    started.addError(Error('failed'));
    expect(started.status).toBe('error');
    vi.advanceTimersByTime(100);
    expect(started.duration).toBe(50);
    expect(() => started.addTranslations(results)).toThrow('not translating');
  });
});
