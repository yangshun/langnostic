import matter from 'gray-matter';
import { expect, test } from 'vite-plus/test';

import {
  buildTargetMDX,
  buildTargetMDXContent,
  buildTargetMDXFrontmatter,
  generateHash,
  generateMDXContentHashList,
  generateMDXContentSegments,
  generateSourceMDXContentHashMap,
  generateTargetMDXContentHashMap,
  getFrontmatterWithoutExcludedKeys,
} from './mdx-file';

test('segments markdown and JSX and uses stable content hashes', () => {
  const content = '# Hello\n\n<Component />\n\nWorld';
  const segments = generateMDXContentSegments(content);
  expect(segments).toEqual(['# Hello\n', '<Component />\n', 'World\n']);
  const hashes = segments.map(generateHash);
  expect(generateMDXContentHashList(content)).toEqual(hashes);
  expect(generateSourceMDXContentHashMap(content)).toEqual(
    Object.fromEntries(hashes.map((hash, index) => [hash, segments[index]])),
  );
  expect(
    generateTargetMDXContentHashMap(
      '# Bonjour\n\n<Composant />\n\nMonde',
      hashes,
    ),
  ).toEqual(
    Object.fromEntries(
      hashes.map((hash, index) => [
        hash,
        ['# Bonjour\n', '<Composant />\n', 'Monde\n'][index],
      ]),
    ),
  );
  expect(generateMDXContentSegments('')).toEqual([]);
});

test('merges translations, preserved frontmatter and excluded source fields', () => {
  const source = { title: 'Hello', slug: 'hello', added: 'New' };
  expect(
    buildTargetMDXFrontmatter(
      source,
      { title: 'Bonjour', slug: 'old', removed: 'Gone' },
      {},
      ['slug'],
    ),
  ).toEqual({ title: 'Bonjour', slug: 'hello', added: 'New' });
  expect(
    buildTargetMDXFrontmatter(source, { title: 'Old' }, { title: 'Salut' }),
  ).toEqual({ ...source, title: 'Salut' });
  expect(buildTargetMDXFrontmatter(source, {})).toEqual(source);
  expect(getFrontmatterWithoutExcludedKeys(source, ['slug'])).toEqual({
    title: 'Hello',
    added: 'New',
  });
});

test('reorders existing translations and fills new blocks while removing obsolete content', () => {
  const oldSource = 'First\n\nSecond';
  const hashes = generateMDXContentHashList(oldSource);
  expect(
    buildTargetMDXContent('Second\n\nFirst', 'Premier\n\nDeuxième', hashes),
  ).toBe('\nDeuxième\n\nPremier\n');
  const addedHash = generateMDXContentHashList('Third')[0];
  expect(
    buildTargetMDXContent('First\n\nThird', 'Premier\n\nDeuxième', hashes, {
      [addedHash]: 'Troisième',
    }),
  ).toBe('\nPremier\n\nTroisième');
  expect(
    buildTargetMDXContent('First\n\nSecond', '', [], {
      [hashes[0]]: 'Premier',
      [hashes[1]]: 'Deuxième',
    }),
  ).toBe('\nPremier\n\nDeuxième');
  expect(buildTargetMDXContent('First\n\nSecond', 'untrusted', hashes)).toBe(
    '\n\n\n',
  );
});

test('combines translated frontmatter and MDX blocks', () => {
  const hash = generateMDXContentHashList('# Hello')[0];
  const result = matter(
    buildTargetMDX('---\ntitle: Hello\n---\n\n# Hello', '', [], {
      title: 'Bonjour',
      [hash]: '# Bonjour',
    }),
  );
  expect(result.data).toEqual({ title: 'Bonjour' });
  expect(result.content.trim()).toBe('# Bonjour');
});
