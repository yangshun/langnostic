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

describe('Config', () => {
  afterAll(() => {
    fs.rmSync(path.join(process.cwd(), '__fixture__'), { recursive: true });
  });

  describe('constructor', () => {
    test('should throw an error if config file does not exist', () => {
      expect(() => new Config()).toThrowError(
        'Configuration file not found. Run `langnostic init` to create one.',
      );
    });

    test('should load existing config file', () => {
      const dir = path.join(FIXTURE_PATH, 'loading');

      fs.mkdirSync(dir, {
        recursive: true,
      });
      fs.writeFileSync(path.join(dir, 'langnostic.config.ts'), configFileTest);

      const configInstance = new Config(dir);

      expect(configInstance.config).toBeDefined();
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
  });
});
