import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import matter from 'gray-matter';
import type { TranslationFileMetadata, LangnosticPlugin } from 'langnostic';
import { afterEach, beforeEach, expect, test } from 'vite-plus/test';

import mdxPlugin, { type PluginOptions } from './index';
import { processFileForChanges } from './mdx-change-detector';
import { generateHash, generateMDXContentHashList } from './mdx-file';
import registryManager from './registry-manager';

type TranslationStringResult = Parameters<
  LangnosticPlugin['onTranslationBatchComplete']
>[0][number];

let dir: string;
let file: TranslationFileMetadata;
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'langnostic-mdx-'));
  file = {
    source: { locale: 'en', path: path.join(dir, 'en.mdx') },
    targets: ['fr', 'de'].map((locale) => ({
      locale,
      path: path.join(dir, `${locale}.mdx`),
    })),
  };
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});
const doc = (
  content: string,
  data: Record<string, string> = { title: 'Hello', slug: 'hello' },
) => matter.stringify(content, data);

async function applyFileChanges(
  metadata: TranslationFileMetadata,
  options?: PluginOptions,
) {
  const updates: Array<() => Promise<void>> = [];
  const changes = await processFileForChanges(metadata, options, updates);
  for (const update of updates) {
    await update();
  }
  return changes;
}

test('discovers and writes MDX translations and persists the registry for incremental runs', async () => {
  await writeFile(file.source.path, doc('# Hello'));
  const plugin = mdxPlugin({ frontmatterExcludedKeys: ['slug'] });
  expect(plugin.type).toBe('mdx');
  expect(plugin.stringsPerRequest).toBe(20);
  expect(await plugin.getInstructions?.()).toContain('MDX');
  await plugin.trackFiles([file]);
  const strings = await plugin.getTranslationStrings();
  expect(strings.map((s) => s.id)).toEqual([
    'title',
    generateMDXContentHashList('# Hello')[0],
  ]);
  expect(strings.every((s) => s.targets.join(',') === 'fr,de')).toBe(true);
  const translated: TranslationStringResult[] = strings.map((s) => ({
    ...s,
    targets: s.targets.map((locale) => ({
      locale,
      string: s.id === 'title' ? `Title ${locale}` : `# Body ${locale}`,
    })),
  }));
  await plugin.onTranslationBatchComplete(translated);
  const target = matter(await readFile(file.targets[0].path, 'utf8'));
  expect(target.data).toEqual({ title: 'Title fr', slug: 'hello' });
  expect(target.content.trim()).toBe('# Body fr');
  const registry = await registryManager().load(file.source.path);
  expect(registry.frontmatter).toEqual({ title: generateHash('Hello') });
  expect(registry.content.targets.fr).toEqual(
    generateMDXContentHashList('# Hello'),
  );
  expect(await plugin.getTranslationStrings()).toEqual([]);
  await plugin.onTranslationBatchComplete(translated);
  expect(
    matter(await readFile(file.targets[0].path, 'utf8')).content.trim(),
  ).toBe('# Body fr');
});

test('ignores empty and unrelated completion callbacks and handles missing locale translations', async () => {
  await writeFile(file.source.path, doc('Hello'));
  const plugin = mdxPlugin();
  await plugin.trackFiles([file]);
  await plugin.onTranslationBatchComplete([]);
  const result: TranslationStringResult = {
    batchId: 'other',
    id: 'title',
    source: { locale: 'en', string: 'Hello' },
    targets: [{ locale: 'fr', string: 'Bonjour' }],
  };
  await plugin.onTranslationBatchComplete([result]);
  await plugin.onTranslationBatchComplete([
    { ...result, batchId: file.source.path },
  ]);
  expect(matter(await readFile(file.targets[1].path, 'utf8')).data).toEqual({
    title: 'Hello',
    slug: 'hello',
  });
});

test('loads missing or malformed registries as empty and preserves other target locales on update', async () => {
  const registry = registryManager();
  expect((await registry.load(file.source.path)).content.source).toEqual({
    locale: '',
    hashes: [],
  });
  await writeFile(path.join(dir, 'en.langnostic.json'), 'bad JSON');
  expect((await registry.load(file.source.path)).frontmatter).toEqual({});
  await writeFile(file.source.path, doc('Hello'));
  await registry.updateFileRegistry(file, { frontmatterExcludedKeys: [] });
  await registry.updateFileRegistry({
    ...file,
    targets: [{ locale: 'es', path: 'es.mdx' }],
  });
  const saved = await registry.load(file.source.path);
  expect(Object.keys(saved.content.targets).sort()).toEqual(['de', 'es', 'fr']);
  expect(saved.frontmatter.slug).toBe(generateHash('hello'));
});

test('reorders and removes translated blocks and frontmatter without generating new strings', async () => {
  const registry = registryManager();
  const oneTarget = { ...file, targets: [file.targets[0]] };
  await writeFile(
    file.source.path,
    doc('First\n\nSecond\n\nThird', { title: 'Hello', removed: 'Old' }),
  );
  await registry.updateFileRegistry(oneTarget);
  await writeFile(
    file.targets[0].path,
    doc('Premier\n\nDeuxième\n\nTroisième', {
      title: 'Bonjour',
      removed: 'Ancien',
    }),
  );
  await writeFile(file.source.path, doc('Third\n\nFirst', { title: 'Hello' }));
  expect(await applyFileChanges(oneTarget)).toEqual({
    content: { fr: [] },
    frontmatter: { fr: [] },
  });
  const target = matter(await readFile(file.targets[0].path, 'utf8'));
  expect(target.data).toEqual({ title: 'Bonjour' });
  expect(target.content.trim()).toBe('Troisième\n\nPremier');
  const saved = await registry.load(file.source.path);
  expect(saved.frontmatter).toEqual({ title: generateHash('Hello') });
  expect(saved.content.source.hashes).toEqual(
    generateMDXContentHashList('Third\n\nFirst'),
  );
});

test('updates only removed frontmatter while preserving the content registry', async () => {
  const registry = registryManager();
  const oneTarget = { ...file, targets: [file.targets[0]] };
  await writeFile(
    file.source.path,
    doc('First', { title: 'Hello', removed: 'Old' }),
  );
  await registry.updateFileRegistry(oneTarget);
  await writeFile(
    file.targets[0].path,
    doc('Premier', { title: 'Bonjour', removed: 'Ancien' }),
  );
  await writeFile(file.source.path, doc('First', { title: 'Hello' }));
  await applyFileChanges(oneTarget);
  expect(matter(await readFile(file.targets[0].path, 'utf8')).data).toEqual({
    title: 'Bonjour',
  });
  expect((await registry.load(file.source.path)).content.source.hashes).toEqual(
    generateMDXContentHashList('First'),
  );
});

test('updates only reordered blocks while preserving target frontmatter', async () => {
  const registry = registryManager();
  const oneTarget = { ...file, targets: [file.targets[0]] };
  await writeFile(file.source.path, doc('First\n\nSecond'));
  await registry.updateFileRegistry(oneTarget);
  await writeFile(
    file.targets[0].path,
    doc('Premier\n\nDeuxième', { title: 'Bonjour', slug: 'hello' }),
  );
  await writeFile(file.source.path, doc('Second\n\nFirst'));
  await applyFileChanges(oneTarget, { frontmatterExcludedKeys: [] });
  const target = matter(await readFile(file.targets[0].path, 'utf8'));
  expect(target.content.trim()).toBe('Deuxième\n\nPremier');
  expect(target.data.title).toBe('Bonjour');
  expect((await registry.load(file.source.path)).frontmatter.title).toBe(
    generateHash('Hello'),
  );
});

test('copies changed excluded fields and removes excluded fields deleted from source', async () => {
  const oneTarget = { ...file, targets: [file.targets[0]] };
  await writeFile(file.source.path, doc('Hello'));
  await registryManager().updateFileRegistry(oneTarget, {
    frontmatterExcludedKeys: ['slug'],
  });
  await writeFile(
    file.targets[0].path,
    doc('Bonjour', { title: 'Bonjour', slug: 'old', removed: 'obsolete' }),
  );
  expect(
    await applyFileChanges(oneTarget, {
      frontmatterExcludedKeys: ['slug', 'removed'],
    }),
  ).toEqual({ content: { fr: [] }, frontmatter: { fr: [] } });
  expect(matter(await readFile(file.targets[0].path, 'utf8')).data).toEqual({
    title: 'Bonjour',
    slug: 'hello',
  });
});

test('discovery leaves MDX content, frontmatter and registry bytes unchanged', async () => {
  const metadata = { ...file, targets: [file.targets[0]] };
  const options = { frontmatterExcludedKeys: ['slug'] };
  await writeFile(
    file.source.path,
    doc('First\n\nSecond\n\nThird', {
      title: 'Hello',
      slug: 'old',
      removed: 'Old',
    }),
  );
  await registryManager().updateFileRegistry(metadata, options);
  await writeFile(
    file.targets[0].path,
    doc('Premier\n\nDeuxième\n\nTroisième', {
      title: 'Bonjour',
      slug: 'old',
      removed: 'Ancien',
    }),
  );
  await writeFile(file.source.path, doc('Second\n\nFirst'));
  const registryPath = path.join(dir, 'en.langnostic.json');
  const paths = [file.source.path, file.targets[0].path, registryPath];
  const before = await Promise.all(
    paths.map((filePath) => readFile(filePath, 'utf8')),
  );
  const plugin = mdxPlugin(options);
  await plugin.trackFiles([metadata]);
  expect(await plugin.getTranslationStrings()).toEqual([]);
  expect(await plugin.getTranslationStrings()).toEqual([]);
  expect(
    await Promise.all(paths.map((filePath) => readFile(filePath, 'utf8'))),
  ).toEqual(before);
  await plugin.onTranslationStart?.();
  const target = matter(await readFile(file.targets[0].path, 'utf8'));
  expect(target.content.trim()).toBe('Deuxième\n\nPremier');
  expect(target.data).toEqual({ title: 'Bonjour', slug: 'hello' });
  expect(await readFile(registryPath, 'utf8')).not.toBe(before[2]);
  await plugin.onTranslationStart?.();
  expect(await plugin.getTranslationStrings()).toEqual([]);
});

test('updates a legacy registry without content metadata', async () => {
  await writeFile(file.source.path, doc('Hello'));
  await writeFile(path.join(dir, 'en.langnostic.json'), '{}');
  await registryManager().updateFileRegistry(file);
  const saved = await registryManager().load(file.source.path);
  expect(saved.content.source).toEqual({
    locale: 'en',
    hashes: generateMDXContentHashList('Hello'),
  });
  expect(Object.keys(saved.content.targets)).toEqual(['fr', 'de']);
});
