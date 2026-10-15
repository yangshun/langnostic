import fs from 'node:fs';
import path from 'node:path';

import { cosmiconfigSync } from 'cosmiconfig';

import { configFileDefault, configFileJSONDefault } from './config-default';
import { loadDeclarativeConfig } from './declarative';
import type { ConfigType } from './types';
import { validateConfig } from './validate';

const moduleName = 'langnostic';
const configExplorerSync = cosmiconfigSync(moduleName, {
  cache: false,
  searchPlaces: [
    `${moduleName}.config.ts`,
    `${moduleName}.config.js`,
    `${moduleName}.json`,
    `${moduleName}.config.json`,
  ],
  searchStrategy: 'project',
});

export default class Config {
  public static async load(searchFrom?: string): Promise<ConfigType> {
    const result = configExplorerSync.search(searchFrom);

    if (result == null) {
      throw new Error(
        'Configuration file not found. Run `langnostic init` to create one.',
      );
    }

    return path.extname(result.filepath) === '.json'
      ? await loadDeclarativeConfig(result.config, result.filepath)
      : validateConfig(result.config?.default ?? result.config);
  }

  public static initializeConfig(
    searchPath?: string,
    format: 'ts' | 'json' = 'ts',
  ): Readonly<
    | { filepath: null; result: 'error' }
    | { filepath: string; result: 'created' }
    | { filepath: string; result: 'exists' }
  > {
    const result = configExplorerSync.search(searchPath);

    if (result != null) {
      return { filepath: result.filepath, result: 'exists' };
    }

    try {
      const configPath = path.join(
        searchPath ?? process.cwd(),
        format === 'json' ? `${moduleName}.json` : `${moduleName}.config.ts`,
      );

      const template =
        format === 'json' ? configFileJSONDefault : configFileDefault;
      fs.writeFileSync(configPath, `${template.trim()}\n`);

      return { filepath: configPath, result: 'created' };
    } catch (error) {
      console.error(error);
    }

    return { filepath: null, result: 'error' };
  }
}
