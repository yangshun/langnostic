import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, expect, test, vi } from 'vite-plus/test';

import type { TranslationFileMetadata } from './types';
import { validateFilePaths } from './validate-paths';

let dir: string;
let file: TranslationFileMetadata;
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'langnostic-path-validation-'));
  const source = path.join(dir, 'en.json');
  await fs.writeFile(source, '{}');
  file = {
    source: { locale: 'en', path: source },
    targets: [{ locale: 'fr', path: path.join(dir, 'nested/fr.json') }],
  };
});
afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(dir, { recursive: true, force: true });
});

test('accepts distinct destinations with missing parent directories', async () => {
  await expect(validateFilePaths([file])).resolves.toBeUndefined();
  await expect(fs.stat(path.join(dir, 'nested'))).rejects.toMatchObject({
    code: 'ENOENT',
  });
});

test('rejects normalized duplicate destinations across files and groups', async () => {
  const other = {
    ...file,
    targets: [
      { locale: 'de', path: path.join(dir, 'other/../nested/fr.json') },
    ],
  };
  await expect(validateFilePaths([file, other])).rejects.toThrow(
    'configured more than once',
  );
});

test('rejects destinations that overwrite any source file', async () => {
  await expect(
    validateFilePaths([
      { ...file, targets: [{ locale: 'fr', path: file.source.path }] },
    ]),
  ).rejects.toThrow('overwrite a source file');
});

test('resolves symlink aliases for existing files and future destinations', async () => {
  const alias = path.join(dir, 'alias.json');
  await fs.symlink(file.source.path, alias);
  await expect(
    validateFilePaths([{ ...file, targets: [{ locale: 'fr', path: alias }] }]),
  ).rejects.toThrow('overwrite a source file');
  const linkedDirectory = path.join(dir, 'linked');
  await fs.symlink(dir, linkedDirectory);
  await expect(
    validateFilePaths([
      file,
      {
        ...file,
        targets: [
          { locale: 'de', path: path.join(linkedDirectory, 'nested/fr.json') },
        ],
      },
    ]),
  ).rejects.toThrow('configured more than once');
});

test('reports filesystem errors during preflight', async () => {
  vi.spyOn(fs, 'realpath').mockRejectedValueOnce(
    Object.assign(Error('access denied'), { code: 'EACCES' }),
  );
  await expect(validateFilePaths([file])).rejects.toThrow('access denied');
});
