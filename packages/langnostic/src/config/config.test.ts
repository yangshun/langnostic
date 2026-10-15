import fs from 'node:fs';
import path from 'node:path';

import Config from '.';

const configFileTest = `
import type { ConfigType } from 'langnostic';

export default {
  ai: {
    model: 'openai/gpt-5',
  },
  groups: [],
  localeConfig: {
    source: 'en-US',
    target: ['zh-CN'],
  },
} satisfies ConfigType;
`;

const FIXTURE_PATH = path.join(process.cwd(), '__fixture__');
const configJSONTest = JSON.stringify({
  version: 1,
  ai: { model: 'test/model' },
  groups: [],
  localeConfig: { source: 'en', target: ['fr'] },
});

describe('Config', () => {
  afterAll(() => {
    fs.rmSync(path.join(process.cwd(), '__fixture__'), { recursive: true });
  });

  describe('load', () => {
    test('should throw an error if config file does not exist', async () => {
      await expect(Config.load()).rejects.toThrowError(
        'Configuration file not found. Run `langnostic init` to create one.',
      );
    });

    test.each(['ts', 'js'])(
      'should load existing %s config file',
      async (format) => {
        const dir = path.join(FIXTURE_PATH, `loading-${format}`);

        fs.mkdirSync(dir, {
          recursive: true,
        });
        fs.writeFileSync(
          path.join(dir, `langnostic.config.${format}`),
          format === 'ts'
            ? configFileTest
            : configFileTest
                .replace("import type { ConfigType } from 'langnostic';", '')
                .replace(' satisfies ConfigType', ''),
        );

        const config = await Config.load(dir);

        expect(config).toMatchObject({
          ai: { model: 'openai/gpt-5' },
          groups: [],
          localeConfig: { source: 'en-US', target: ['zh-CN'] },
        });
      },
    );

    test('preserves executable config precedence when JSON also exists', async () => {
      const dir = path.join(FIXTURE_PATH, 'precedence');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'langnostic.config.ts'), configFileTest);
      fs.writeFileSync(path.join(dir, 'langnostic.json'), '{"version":2}');
      expect((await Config.load(dir)).ai.model).toBe('openai/gpt-5');
    });

    test('prefers langnostic.json when both JSON filenames exist', async () => {
      const dir = path.join(FIXTURE_PATH, 'json-precedence');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'langnostic.json'), configJSONTest);
      fs.writeFileSync(
        path.join(dir, 'langnostic.config.json'),
        '{"version":2}',
      );
      expect((await Config.load(dir)).ai.model).toBe('test/model');
    });
  });

  describe('initializeConfig', () => {
    test('should initialize default config', () => {
      const dir = path.join(FIXTURE_PATH, 'init');

      fs.mkdirSync(dir, {
        recursive: true,
      });

      const { result } = Config.initializeConfig(dir);

      expect(result).toEqual('created');

      const configPath = path.join(dir, 'langnostic.config.ts');

      expect(fs.existsSync(configPath)).toBe(true);
    });

    test('should not overwrite an existing config file when initializing', () => {
      const dir = path.join(FIXTURE_PATH, 'overwrite');

      fs.mkdirSync(dir, {
        recursive: true,
      });

      const configPath = path.join(dir, 'langnostic.config.ts');

      fs.writeFileSync(configPath, configFileTest);

      const { result } = Config.initializeConfig(dir);

      expect(result).toEqual('exists');
    });

    test('initializes JSON and preserves it when TypeScript initialization is requested', () => {
      const dir = path.join(FIXTURE_PATH, 'init-json');
      fs.mkdirSync(dir, { recursive: true });
      const initialized = Config.initializeConfig(dir, 'json');
      expect(initialized).toEqual({
        result: 'created',
        filepath: path.join(dir, 'langnostic.json'),
      });
      const contents = fs.readFileSync(initialized.filepath!, 'utf8');
      expect(JSON.parse(contents)).toMatchObject({
        version: 1,
        ai: { provider: { module: '@ai-sdk/openai', export: 'createOpenAI' } },
        groups: [{ plugin: '@langnostic/plugin-formatjs' }],
      });
      expect(Config.initializeConfig(dir)).toEqual({
        ...initialized,
        result: 'exists',
      });
      expect(fs.readdirSync(dir)).toEqual(['langnostic.json']);
      expect(fs.readFileSync(initialized.filepath!, 'utf8')).toBe(contents);
    });

    test.each(['langnostic.json', 'langnostic.config.json'])(
      'preserves existing %s across initialization formats',
      (filename) => {
        const dir = path.join(FIXTURE_PATH, `preserve-${filename}`);
        fs.mkdirSync(dir, { recursive: true });
        const filepath = path.join(dir, filename);
        fs.writeFileSync(filepath, configJSONTest);
        for (const format of ['ts', 'json'] as const) {
          expect(Config.initializeConfig(dir, format)).toEqual({
            result: 'exists',
            filepath,
          });
        }
        expect(fs.readdirSync(dir)).toEqual([filename]);
        expect(fs.readFileSync(filepath, 'utf8')).toBe(configJSONTest);
      },
    );
  });
});
