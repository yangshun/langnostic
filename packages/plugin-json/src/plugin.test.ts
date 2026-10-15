import fs from 'node:fs/promises';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { TranslationFileMetadata, LangnosticPlugin } from 'langnostic';
import { afterEach, beforeEach, expect, test, vi } from 'vite-plus/test';

import JsonPlugin from './index';
import { processFileForChanges } from './json-change-detector';

type TranslationStringResult = Parameters<
  LangnosticPlugin['onTranslationBatchComplete']
>[0][number];

let dir: string;
let file: TranslationFileMetadata;
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'langnostic-json-'));
  file = {
    source: { locale: 'en', path: path.join(dir, 'en.json') },
    targets: ['fr', 'de'].map((locale) => ({
      locale,
      path: path.join(dir, `${locale}.json`),
    })),
  };
});
afterEach(async () => {
  vi.restoreAllMocks();
  await rm(dir, { recursive: true, force: true });
});

function result(id: string, string: string): TranslationStringResult {
  return {
    batchId: file.source.path,
    id,
    source: { locale: 'en', string: 'Hello' },
    targets: [{ locale: 'fr', string }],
  };
}

test('discovers missing strings, removes obsolete keys and writes sorted translations with descriptions', async () => {
  await writeFile(
    file.source.path,
    JSON.stringify({
      z: 'Last',
      a: { defaultMessage: 'Hello', description: 'Greeting' },
      kept: 'Keep',
    }),
  );
  await writeFile(
    file.targets[0].path,
    JSON.stringify({ obsolete: 'Remove', kept: 'Garder' }),
  );
  const plugin = JsonPlugin();
  await plugin.trackFiles([file]);
  expect(plugin.type).toBe('json');
  expect(plugin.stringsPerRequest).toBe(50);
  expect(await plugin.getInstructions?.()).toContain('ICU');
  const strings = await plugin.getTranslationStrings();
  expect(strings).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: 'a',
        source: { locale: 'en', string: 'Hello', description: 'Greeting' },
        targets: ['fr', 'de'],
      }),
      expect.objectContaining({ id: 'kept', targets: ['de'] }),
    ]),
  );
  expect(JSON.parse(await readFile(file.targets[0].path, 'utf8'))).toEqual({
    obsolete: 'Remove',
    kept: 'Garder',
  });
  await plugin.onTranslationStart?.();
  expect(JSON.parse(await readFile(file.targets[0].path, 'utf8'))).toEqual({
    kept: 'Garder',
  });
  await plugin.onTranslationBatchComplete([
    result('z', 'Fin'),
    result('a', 'Bonjour'),
  ]);
  const target = JSON.parse(await readFile(file.targets[0].path, 'utf8'));
  expect(target).toEqual({
    a: { defaultMessage: 'Bonjour', description: 'Greeting' },
    kept: 'Garder',
    z: 'Fin',
  });
  expect(Object.keys(target)).toEqual(['a', 'kept', 'z']);
  expect(JSON.parse(await readFile(file.targets[1].path, 'utf8'))).toEqual({});
});

test('plans removal-only changes without writing until a real run starts', async () => {
  await writeFile(file.source.path, '{"hello":"Hello"}');
  await writeFile(
    file.targets[0].path,
    '{ "hello": "Bonjour", "old": "Old" }\n',
  );
  const plugin = JsonPlugin();
  await plugin.trackFiles([{ ...file, targets: [file.targets[0]] }]);
  const before = await readFile(file.targets[0].path, 'utf8');
  expect(await plugin.getTranslationStrings()).toEqual([]);
  expect(await plugin.getTranslationStrings()).toEqual([]);
  expect(await readFile(file.targets[0].path, 'utf8')).toBe(before);
  await plugin.onTranslationStart?.();
  expect(JSON.parse(await readFile(file.targets[0].path, 'utf8'))).toEqual({
    hello: 'Bonjour',
  });
  await plugin.onTranslationStart?.();
});

test('ignores empty and unrelated batches but reports unreadable sources', async () => {
  const plugin = JsonPlugin();
  await plugin.trackFiles([file]);
  await plugin.onTranslationBatchComplete([]);
  await plugin.onTranslationBatchComplete([
    { ...result('hello', 'Bonjour'), batchId: 'other.json' },
  ]);
  await expect(
    plugin.onTranslationBatchComplete([result('hello', 'Bonjour')]),
  ).rejects.toMatchObject({ code: 'ENOENT' });
  await writeFile(file.source.path, 'invalid json');
  await expect(
    plugin.onTranslationBatchComplete([result('hello', 'Bonjour')]),
  ).rejects.toBeInstanceOf(SyntaxError);
  await writeFile(file.source.path, '{"hello":"Hello"}');
  vi.spyOn(fs, 'readFile')
    .mockResolvedValueOnce('{"hello":"Hello"}')
    .mockRejectedValueOnce(Error('source removed'));
  await expect(plugin.getTranslationStrings()).rejects.toThrow(
    'source removed',
  );
});

test('handles empty and missing targets when detecting changes', async () => {
  await writeFile(file.source.path, '{"hello":"Hello"}');
  await writeFile(file.targets[0].path, '');
  expect(await processFileForChanges(file)).toEqual({
    fr: ['hello'],
    de: ['hello'],
  });
});

test('preserves unreadable target JSON and reports target read failures', async () => {
  await writeFile(file.source.path, '{"hello":"Hello"}');
  await writeFile(file.targets[0].path, 'invalid');
  const plugin = JsonPlugin();
  await plugin.trackFiles([{ ...file, targets: [file.targets[0]] }]);
  await expect(
    plugin.onTranslationBatchComplete([result('hello', 'Bonjour')]),
  ).rejects.toBeInstanceOf(SyntaxError);
  expect(await readFile(file.targets[0].path, 'utf8')).toBe('invalid');
  vi.spyOn(fs, 'readFile')
    .mockResolvedValueOnce('{"hello":"Hello"}')
    .mockRejectedValueOnce(
      Object.assign(Error('access denied'), { code: 'EACCES' }),
    );
  await expect(
    plugin.onTranslationBatchComplete([result('hello', 'Salut')]),
  ).rejects.toThrow('access denied');
});

test('creates missing destination directories and leaves no temporary files', async () => {
  await writeFile(file.source.path, '{"hello":"Hello"}');
  const target = {
    locale: 'fr',
    path: path.join(dir, 'new-directory/fr.json'),
  };
  const plugin = JsonPlugin();
  await plugin.trackFiles([{ ...file, targets: [target] }]);
  await plugin.onTranslationBatchComplete([result('hello', 'Bonjour')]);
  expect(JSON.parse(await readFile(target.path, 'utf8'))).toEqual({
    hello: 'Bonjour',
  });
  expect(await fs.readdir(path.dirname(target.path))).toEqual(['fr.json']);
});
