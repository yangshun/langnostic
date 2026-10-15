import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, expect, test, vi } from 'vite-plus/test';

import { writeFileAtomic, writeJsonAtomic } from './files';

let dir: string;
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'langnostic-atomic-'));
});
afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(dir, { recursive: true, force: true });
});

test('creates missing directories and replaces complete files while preserving permissions', async () => {
  const target = path.join(dir, 'nested/fr.json');
  await writeJsonAtomic(target, { hello: 'Bonjour' });
  expect(await fs.readFile(target, 'utf8')).toBe(
    '{\n  "hello": "Bonjour"\n}\n',
  );
  await fs.chmod(target, 0o640);
  await writeFileAtomic(target, 'replacement');
  expect(await fs.readFile(target, 'utf8')).toBe('replacement');
  expect((await fs.stat(target)).mode & 0o777).toBe(0o640);
  expect(await fs.readdir(path.dirname(target))).toEqual(['fr.json']);
});

test('preserves symlinks when replacing their destination', async () => {
  const target = path.join(dir, 'fr.json');
  const alias = path.join(dir, 'alias.json');
  await fs.writeFile(target, 'old');
  await fs.symlink(target, alias);
  await writeFileAtomic(alias, 'new');
  expect(await fs.readFile(target, 'utf8')).toBe('new');
  expect((await fs.lstat(alias)).isSymbolicLink()).toBe(true);
});

test('cleans up partial temporary files after a failed write', async () => {
  const target = path.join(dir, 'fr.json');
  await fs.writeFile(target, 'original');
  const writeFile = fs.writeFile;
  vi.spyOn(fs, 'writeFile').mockImplementationOnce(
    async (temporaryPath, _content, options) => {
      await writeFile(temporaryPath, 'partial', options);
      throw Error('disk full');
    },
  );
  await expect(writeFileAtomic(target, 'replacement')).rejects.toThrow(
    'disk full',
  );
  expect(await fs.readFile(target, 'utf8')).toBe('original');
  expect(await fs.readdir(dir)).toEqual(['fr.json']);
});

test('preserves the original file and removes temporary files after a failed rename', async () => {
  const target = path.join(dir, 'fr.json');
  await fs.writeFile(target, 'original');
  vi.spyOn(fs, 'rename').mockRejectedValueOnce(Error('rename failed'));
  await expect(writeFileAtomic(target, 'replacement')).rejects.toThrow(
    'rename failed',
  );
  expect(await fs.readFile(target, 'utf8')).toBe('original');
  expect(await fs.readdir(dir)).toEqual(['fr.json']);
});

test('reports failures reading destination metadata', async () => {
  vi.spyOn(fs, 'stat').mockRejectedValueOnce(
    Object.assign(Error('access denied'), { code: 'EACCES' }),
  );
  await expect(
    writeFileAtomic(path.join(dir, 'fr.json'), 'replacement'),
  ).rejects.toThrow('access denied');
  expect(await fs.readdir(dir)).toEqual([]);
});
