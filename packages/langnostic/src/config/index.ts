import fs from 'node:fs';
import path from 'node:path';

import { cosmiconfigSync } from 'cosmiconfig';

import { configFileDefault } from './config-default';
import type { ConfigType } from './types';
import { validateConfig } from './validate';

const moduleName = 'langnostic';
const configExplorerSync = cosmiconfigSync(moduleName, {
  searchPlaces: [`${moduleName}.config.ts`, `${moduleName}.config.js`],
  searchStrategy: 'project',
});

export default class Config {
  #config: ConfigType;

  constructor(searchFrom?: string) {
    const result = configExplorerSync.search(searchFrom);

    if (result == null) {
      throw new Error(
        'Configuration file not found. Run `langnostic init` to create one.',
      );
    }

    this.#config = validateConfig(result.config?.default ?? result.config);
  }

  get config(): ConfigType {
    return this.#config;
  }

  public static initializeConfig(
    searchPath?: string,
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
        'langnostic.config.ts',
      );

      fs.writeFileSync(configPath, `${configFileDefault.trim()}\n`);

      return { filepath: configPath, result: 'created' };
    } catch (error) {
      console.error(error);
    }

    return { filepath: null, result: 'error' };
  }
}
