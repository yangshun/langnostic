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
  for (const name of ['langnostic', 'plugin-formatjs', 'plugin-mdx']) {
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
  declarative?: boolean;
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
  const modelSource = `
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
`;
  if (options.declarative) {
    await fs.writeFile(
      path.join(cwd, 'provider.mjs'),
      `import fs from 'node:fs/promises';
${modelSource}
export function createProvider(options) {
  if (options.token !== 'fixture-token') throw Error('Environment reference was not resolved');
  return { languageModel(modelId) { return { ...model, modelId }; } };
}
`,
    );
    await fs.writeFile(
      path.join(cwd, '.env'),
      'LANGNOSTIC_FIXTURE_TOKEN=fixture-token\n',
    );
    await fs.writeFile(
      path.join(cwd, 'langnostic.json'),
      JSON.stringify({
        version: 1,
        ai: {
          provider: {
            module: './provider.mjs',
            export: 'createProvider',
            options: { token: { env: 'LANGNOSTIC_FIXTURE_TOKEN' } },
          },
          model: 'any-new-model',
        },
        concurrencyLimit: options.concurrency ?? 2,
        localeConfig: { source: 'en', target: options.locales ?? ['fr'] },
        groups: [
          {
            name: 'app',
            stringsPerRequest: 1,
            plugin:
              format === 'json'
                ? '@langnostic/plugin-formatjs'
                : {
                    module: '@langnostic/plugin-mdx',
                    options: { frontmatterExcludedKeys: ['slug'] },
                  },
            paths: [
              {
                source: options.source ?? source,
                target: options.target ?? `{locale}.${format}`,
              },
            ],
          },
        ],
      }),
    );
    return cwd;
  }
  await fs.writeFile(
    path.join(cwd, 'langnostic.config.ts'),
    `
import fs from 'node:fs/promises';
import FormatJSPlugin from '@langnostic/plugin-formatjs';
import MdxPlugin from '@langnostic/plugin-mdx';
import type { ConfigType } from 'langnostic';

${modelSource}
const group = {
  name: 'app', stringsPerRequest: 1,
  plugin: ${format === 'json' ? 'FormatJSPlugin()' : "MdxPlugin({ frontmatterExcludedKeys: ['slug'] })"},
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
import FormatJSPlugin from '@langnostic/plugin-formatjs';
import MdxPlugin from '@langnostic/plugin-mdx';
import { buildTranslationStrings, writeJsonAtomic, type ConfigType, type DeclarativeConfigType, type ModuleReference } from 'langnostic';
export const reference = { module: '@langnostic/plugin-mdx', options: { frontmatterExcludedKeys: ['slug'] } } satisfies ModuleReference;
export const plainConfig = {
  version: 1,
  ai: { provider: { module: './provider.mjs', export: 'createProvider' }, model: 'any-new-model' },
  localeConfig: { source: 'en', target: ['fr'] },
  groups: [{ name: 'docs', plugin: reference, paths: [{ source: 'en.mdx', target: '{locale}.mdx' }] }],
} satisfies DeclarativeConfigType;
export const config = {
  ai: { model: 'local-test/mock' }, localeConfig: { source: 'en', target: ['fr'] },
  groups: [FormatJSPlugin(), MdxPlugin()].map((plugin, index) => ({
    name: String(index), plugin, paths: [{ source: 'en.json', target: 'fr.json' }],
  })),
} satisfies ConfigType;
export const write: (path: string, value: unknown) => Promise<void> = writeJsonAtomic;
export const strings = buildTranslationStrings(
  { greeting: { string: 'Hello', description: 'Greeting' } },
  { fr: ['greeting'] },
  { source: { locale: 'en', path: 'en.json' }, targets: [{ locale: 'fr', path: 'fr.json' }] },
);
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
  const config = await fs.readFile(
    path.join(cwd, 'langnostic.config.ts'),
    'utf8',
  );
  expect(config).toContain(
    "import FormatJSPlugin from '@langnostic/plugin-formatjs';",
  );
  expect(config).toContain('plugin: FormatJSPlugin()');
  expect(config).toContain('satisfies ConfigType');
  expect(run(cwd, ['--help']).output).toContain('translate');
});

test.each(['langnostic.json', 'langnostic.config.json'])(
  'initializes JSON without overwriting existing %s',
  async (filename) => {
    const cwd = path.join(consumer, randomUUID());
    await fs.mkdir(cwd);
    expect(run(cwd, ['init', '--format', 'json']).status).toBe(0);
    const filepath = path.join(cwd, filename);
    if (filename !== 'langnostic.json') {
      await fs.rename(path.join(cwd, 'langnostic.json'), filepath);
    }
    const original = await fs.readFile(filepath, 'utf8');
    expect(JSON.parse(original)).toMatchObject({
      version: 1,
      ai: { provider: { module: '@ai-sdk/openai', export: 'createOpenAI' } },
      groups: [{ plugin: '@langnostic/plugin-formatjs' }],
    });
    expect(run(cwd, ['init']).output).toContain('already exists');
    expect(await fs.readFile(filepath, 'utf8')).toBe(original);
    expect(await fs.readdir(cwd)).toEqual([filename]);
  },
);

test.each([
  { format: 'json', filename: 'langnostic.json' },
  { format: 'mdx', filename: 'langnostic.json' },
  { format: 'json', filename: 'langnostic.config.json' },
  { format: 'mdx', filename: 'langnostic.config.json' },
] as const)(
  'translates and dry-runs $format using $filename and project-installed plugins',
  async ({ format, filename }) => {
    const cwd = await fixture(format, {
      declarative: true,
      locales: ['fr', 'de'],
    });
    if (filename !== 'langnostic.json') {
      await fs.rename(
        path.join(cwd, 'langnostic.json'),
        path.join(cwd, filename),
      );
    }
    const before = await snapshot(cwd);
    const dry = run(cwd, ['translate', '--dry-run'], 'provider-error');
    expect(dry.status, dry.output).toBe(0);
    expect(await snapshot(cwd)).toEqual(before);
    const result = run(cwd);
    expect(result.status, result.output).toBe(0);
    const target = await fs.readFile(path.join(cwd, `fr.${format}`), 'utf8');
    if (format === 'json') {
      expect(JSON.parse(target)).toEqual({ hello: 'Bonjour' });
    } else {
      expect(target).toContain('title: Bonjour');
      expect(target).toContain('slug: hello');
      expect(target).toContain('Bonjour');
    }
    const translated = await snapshot(cwd);
    const again = run(cwd, ['translate'], 'provider-error');
    expect(again.status, again.output).toBe(0);
    expect(again.output).toContain('Nothing to translate');
    expect(await snapshot(cwd)).toEqual(translated);
  },
);

test('reports missing plugin packages from declarative configuration without changing files', async () => {
  const cwd = await fixture('json', { declarative: true });
  const filepath = path.join(cwd, 'langnostic.json');
  const config = JSON.parse(await fs.readFile(filepath, 'utf8'));
  config.groups[0].plugin = 'uninstalled-langnostic-plugin';
  await fs.writeFile(filepath, JSON.stringify(config));
  const before = await snapshot(cwd);
  const result = run(cwd);
  expect(result.status, result.output).toBe(1);
  expect(result.output).toContain(
    'groups.0.plugin: Cannot load "uninstalled-langnostic-plugin"',
  );
  expect(await snapshot(cwd)).toEqual(before);
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
