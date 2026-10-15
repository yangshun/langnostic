import { execFileSync, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, expect, test } from 'vite-plus/test';

const packageRoot = fileURLToPath(new URL('../../', import.meta.url));
const repository = path.resolve(packageRoot, '../..');
let directory: string;
let consumer: string;
let cli: string;

beforeAll(async () => {
  directory = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'langnostic-integration-')),
  );
  consumer = path.join(directory, 'consumer');
  await fs.mkdir(consumer);
  const dependencies: Record<string, string> = {};
  for (const name of ['langnostic', 'plugin-json', 'plugin-mdx']) {
    const cwd = path.join(repository, 'packages', name);
    const metadata = JSON.parse(
      await fs.readFile(path.join(cwd, 'package.json'), 'utf8'),
    );
    const archive = path.join(directory, `${name}.tgz`);
    execFileSync('vp', ['pm', 'pack', '--out', archive], {
      cwd,
      timeout: 30_000,
      stdio: 'pipe',
    });
    dependencies[metadata.name] = `file:${archive}`;
  }
  const workspace = JSON.parse(
    await fs.readFile(path.join(repository, 'package.json'), 'utf8'),
  );
  await fs.writeFile(
    path.join(consumer, 'package.json'),
    JSON.stringify({
      name: 'langnostic-packed-consumer',
      private: true,
      type: 'module',
      packageManager: workspace.packageManager,
      dependencies,
    }),
  );
  execFileSync(
    'vp',
    ['install', '--ignore-scripts', '--no-frozen-lockfile', '--prefer-offline'],
    {
      cwd: consumer,
      timeout: 120_000,
      stdio: 'pipe',
    },
  );
  cli = path.join(consumer, 'node_modules/langnostic/dist/cli.js');
});
afterAll(async () => {
  if (directory) await fs.rm(directory, { recursive: true, force: true });
});

type FixtureOptions = {
  target?: string;
  source?: string;
  concurrency?: number;
  locales?: Array<string>;
  duplicateGroup?: boolean;
};

async function fixture(
  format: 'json' | 'mdx' = 'json',
  options: FixtureOptions = {},
) {
  const cwd = path.join(consumer, randomUUID());
  await fs.mkdir(cwd);
  const source = `en.${format}`;
  await fs.writeFile(
    path.join(cwd, source),
    format === 'json'
      ? '{"hello":"Hello"}'
      : '---\ntitle: Hello\nslug: hello\n---\n\nHello\n',
  );
  await fs.writeFile(
    path.join(cwd, 'langnostic.config.ts'),
    `
import fs from 'node:fs/promises';
import JsonPlugin from '@langnostic/plugin-json';
import MdxPlugin from '@langnostic/plugin-mdx';
import type { ConfigType } from 'langnostic';

const model = {
  specificationVersion: 'v4', provider: 'local-test', modelId: 'mock', supportedUrls: {},
  async doGenerate(options) {
    const mode = process.env.LANGNOSTIC_TEST_MODE;
    if (mode === 'provider-error') throw Error('Simulated provider failure');
    if (mode === 'write-error') fs.rename = async () => { throw Error('Simulated write failure'); };
    const text = options.prompt.find(message => message.role === 'user').content.find(part => part.type === 'text').text;
    const payload = JSON.parse(text.slice(text.lastIndexOf('<json>') + 6, text.lastIndexOf('</json>')).trim());
    const data = payload.map(item => ({
      batchId: item.batchId, id: item.id,
      translations: item.targets.map(locale => ({ locale, string: item.source.string.replaceAll('Hello', locale === 'fr' ? 'Bonjour' : 'Hallo') })),
    }));
    if (mode === 'missing-row') data.pop();
    if (mode === 'missing-locale') data[0].translations.pop();
    return {
      content: [{ type: 'text', text: JSON.stringify({ data }) }],
      finishReason: { unified: 'stop', raw: 'STOP' },
      usage: { inputTokens: { total: 1, noCache: 1 }, outputTokens: { total: 1, text: 1 } },
      warnings: [],
    };
  },
};
const group = {
  name: 'app', stringsPerRequest: 1,
  plugin: ${format === 'json' ? 'JsonPlugin()' : "MdxPlugin({ frontmatterExcludedKeys: ['slug'] })"},
  paths: [{ source: ${JSON.stringify(options.source ?? source)}, target: ${JSON.stringify(options.target ?? `{locale}.${format}`)} }],
};
export default {
  ai: { model }, concurrencyLimit: ${options.concurrency ?? 2},
  localeConfig: { source: 'en', target: ${JSON.stringify(options.locales ?? ['fr'])} },
  groups: [group${options.duplicateGroup ? ', group' : ''}],
} satisfies ConfigType;
`,
  );
  return cwd;
}

function run(cwd: string, args = ['translate'], mode = 'complete') {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 15_000,
    env: {
      ...process.env,
      NO_COLOR: '1',
      FORCE_COLOR: '0',
      LANGNOSTIC_TEST_MODE: mode,
    },
  });
  expect(result.error, result.stdout + result.stderr).toBeUndefined();
  return { ...result, output: result.stdout + result.stderr };
}

async function snapshot(cwd: string) {
  const names = (await fs.readdir(cwd, { recursive: true })).sort();
  return Promise.all(
    names.map(async (name) => {
      const file = path.join(cwd, name);
      return [
        name,
        (await fs.stat(file)).isDirectory()
          ? null
          : await fs.readFile(file, 'utf8'),
      ];
    }),
  );
}

test('installs actual tarballs outside the workspace and exposes usable public types', async () => {
  const installed = await fs.realpath(
    path.join(consumer, 'node_modules/langnostic'),
  );
  expect(installed.startsWith(directory)).toBe(true);
  expect(installed.startsWith(repository)).toBe(false);
  await fs.writeFile(
    path.join(consumer, 'types.ts'),
    `
import JsonPlugin from '@langnostic/plugin-json';
import MdxPlugin from '@langnostic/plugin-mdx';
import { writeJsonAtomic, type ConfigType } from 'langnostic';
export const config = {
  ai: { model: 'local-test/mock' }, localeConfig: { source: 'en', target: ['fr'] },
  groups: [JsonPlugin(), MdxPlugin()].map((plugin, index) => ({
    name: String(index), plugin, paths: [{ source: 'en.json', target: 'fr.json' }],
  })),
} satisfies ConfigType;
export const write: (path: string, value: unknown) => Promise<void> = writeJsonAtomic;
`,
  );
  await fs.writeFile(
    path.join(consumer, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        target: 'ES2022',
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        types: [],
      },
      files: ['types.ts'],
    }),
  );
  execFileSync(
    'vp',
    ['exec', 'tsc', '--project', path.join(consumer, 'tsconfig.json')],
    { cwd: packageRoot, timeout: 30_000, stdio: 'pipe' },
  );
});

test('initializes a config and prints help from the installed CLI', async () => {
  const cwd = path.join(consumer, randomUUID());
  await fs.mkdir(cwd);
  expect(run(cwd, ['init']).status).toBe(0);
  expect(
    await fs.readFile(path.join(cwd, 'langnostic.config.ts'), 'utf8'),
  ).toContain('satisfies ConfigType');
  expect(run(cwd, ['--help']).output).toContain('translate');
});

test('translates multiple JSON chunks into new directories and is idempotent', async () => {
  const cwd = await fixture('json', {
    target: 'new/{locale}.json',
    locales: ['fr', 'de'],
  });
  await fs.writeFile(
    path.join(cwd, 'en.json'),
    '{"a":"Hello","b":{"defaultMessage":"Hello again","description":"Greeting"}}',
  );
  const result = run(cwd);
  expect(result.status, result.output).toBe(0);
  expect(result.output).toContain('1 successful');
  expect(result.output).toContain('en.json');
  expect(
    JSON.parse(await fs.readFile(path.join(cwd, 'new/fr.json'), 'utf8')),
  ).toEqual({
    a: 'Bonjour',
    b: { defaultMessage: 'Bonjour again', description: 'Greeting' },
  });
  expect(
    JSON.parse(await fs.readFile(path.join(cwd, 'new/de.json'), 'utf8')).a,
  ).toBe('Hallo');
  const before = await snapshot(cwd);
  const again = run(cwd, ['translate'], 'provider-error');
  expect(again.status, again.output).toBe(0);
  expect(again.output).toContain('Nothing to translate');
  expect(await snapshot(cwd)).toEqual(before);
});

test.each([false, true])(
  'JSON dry runs leave all bytes unchanged with pending translations: %s',
  async (pending) => {
    const cwd = await fixture();
    if (pending)
      await fs.writeFile(
        path.join(cwd, 'en.json'),
        '{"hello":"Hello","new":"Hello again"}',
      );
    await fs.writeFile(
      path.join(cwd, 'fr.json'),
      '{ "hello": "Bonjour", "obsolete": "Old" }\n',
    );
    const before = await snapshot(cwd);
    const result = run(
      cwd,
      ['translate', '--dry-run', '--debug'],
      'provider-error',
    );
    expect(result.status, result.output).toBe(0);
    expect(await snapshot(cwd)).toEqual(before);
  },
);

test('MDX dry runs preserve targets and registries while real removal-only runs apply maintenance', async () => {
  const cwd = await fixture('mdx');
  await fs.writeFile(
    path.join(cwd, 'en.mdx'),
    '---\ntitle: Hello\nslug: old\nremoved: Old\n---\n\nFirst\n\nSecond\n\nThird\n',
  );
  const first = run(cwd);
  expect(first.status, first.output).toBe(0);
  await fs.writeFile(
    path.join(cwd, 'fr.mdx'),
    '---\ntitle: Bonjour\nslug: old\nremoved: Ancien\n---\n\nPremier\n\nDeuxième\n\nTroisième\n',
  );
  await fs.writeFile(
    path.join(cwd, 'en.mdx'),
    '---\ntitle: Hello\nslug: new\n---\n\nThird\n\nFirst\n',
  );
  const before = await snapshot(cwd);
  const dry = run(cwd, ['translate', '--dry-run'], 'provider-error');
  expect(dry.status, dry.output).toBe(0);
  expect(await snapshot(cwd)).toEqual(before);
  const real = run(cwd, ['translate'], 'provider-error');
  expect(real.status, real.output).toBe(0);
  const target = await fs.readFile(path.join(cwd, 'fr.mdx'), 'utf8');
  expect(target).toContain('Troisième\n\nPremier');
  expect(target).toContain('slug: new');
  expect(target).not.toContain('removed:');
});

test('returns a nonzero exit code with provider errors and the affected filename', async () => {
  const cwd = await fixture();
  const result = run(cwd, ['translate'], 'provider-error');
  expect(result.status).toBe(1);
  expect(result.output).toContain('Simulated provider failure');
  expect(result.output).toContain('en.json');
  expect(result.output).toContain('1 failed');
  expect(await fs.readdir(cwd)).toEqual(['en.json', 'langnostic.config.ts']);
});

test.each(['missing-row', 'missing-locale'])(
  'rejects incomplete model results without creating target files: %s',
  async (mode) => {
    const cwd = await fixture('json', { locales: ['fr', 'de'] });
    const result = run(cwd, ['translate'], mode);
    expect(result.status).toBe(1);
    expect(result.output).toContain(
      mode === 'missing-row' ? 'Missing translation' : 'Missing locale de',
    );
    expect(await fs.readdir(cwd)).toEqual(['en.json', 'langnostic.config.ts']);
  },
);

test.each(['json', 'mdx'] as const)(
  'reports write failures and preserves files and registries for %s',
  async (format) => {
    const cwd = await fixture(format);
    const first = run(cwd);
    expect(first.status, first.output).toBe(0);
    await fs.writeFile(
      path.join(cwd, `en.${format}`),
      format === 'json'
        ? '{"hello":"Hello","new":"Hello again"}'
        : '---\ntitle: Hello\nslug: hello\n---\n\nHello\n\nHello again\n',
    );
    const before = await snapshot(cwd);
    const result = run(cwd, ['translate'], 'write-error');
    expect(result.status, result.output).toBe(1);
    expect(result.output).toContain('Simulated write failure');
    expect(result.output).toContain('0 successful');
    expect(await snapshot(cwd)).toEqual(before);
  },
);

test.each([
  [{ concurrency: 0 }, 'concurrencyLimit'],
  [{ duplicateGroup: true }, 'Duplicate translation group name'],
  [{ locales: ['fr', 'de'], target: 'same.json' }, 'configured more than once'],
  [{ target: 'en.json' }, 'overwrite a source file'],
])(
  'rejects invalid configuration or paths without modifying files: %s',
  async (options, message) => {
    const cwd = await fixture('json', options);
    const before = await snapshot(cwd);
    const result = run(cwd);
    expect(result.status, result.output).toBe(1);
    expect(result.output).toContain(message);
    expect(await snapshot(cwd)).toEqual(before);
  },
);

test('warns when source patterns match no files', async () => {
  const cwd = await fixture('json', { source: 'missing*.json' });
  const result = run(cwd);
  expect(result.status, result.output).toBe(0);
  expect(result.output).toContain('No source files matched: missing*.json');
});
