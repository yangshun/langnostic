import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { expect, test, vi } from 'vite-plus/test';

import { expandTargetPaths, generateTargetPaths } from './index';

test('rejects source paths outside the configured pattern', () => {
  expect(() =>
    generateTargetPaths('en/*.json', 'fr/*.json', 'de/a.json', ['fr']),
  ).toThrow('does not match');
});

test('rejects target wildcard captures missing from the source pattern', () => {
  expect(() =>
    generateTargetPaths('en.json', 'fr/*.json', 'en.json', ['fr']),
  ).toThrow('more wildcards');
});

test('maps literal source paths to locale-specific destinations', () => {
  expect(
    generateTargetPaths('en.json', '{locale}.json', 'en.json', ['fr']),
  ).toEqual([{ locale: 'fr', path: 'fr.json' }]);
});

test('expands real glob matches including zero or multiple subdirectories', async () => {
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const dir = await mkdtemp(path.join(os.tmpdir(), 'langnostic-paths-'));
  try {
    await mkdir(path.join(dir, 'nested'));
    await writeFile(path.join(dir, 'a.json'), '{}');
    await writeFile(path.join(dir, 'nested/b.json'), '{}');
    const files = await expandTargetPaths(
      { source: 'en', target: ['fr'] },
      { source: `${dir}/**/*.json`, target: `${dir}/fr/**/*.json` },
    );
    expect(files).toEqual(
      expect.arrayContaining([
        {
          source: { locale: 'en', path: `${dir}/a.json` },
          targets: [{ locale: 'fr', path: `${dir}/fr/a.json` }],
        },
        {
          source: { locale: 'en', path: `${dir}/nested/b.json` },
          targets: [{ locale: 'fr', path: `${dir}/fr/nested/b.json` }],
        },
      ]),
    );
    expect(files).toHaveLength(2);
    await expect(
      expandTargetPaths(
        { source: 'en', target: [] },
        { source: `${dir}/*.missing`, target: '*' },
      ),
    ).resolves.toEqual([]);
    expect(warning).toHaveBeenCalledWith(
      `No source files matched: ${dir}/*.missing`,
    );
  } finally {
    warning.mockRestore();
    await rm(dir, { recursive: true, force: true });
  }
});
