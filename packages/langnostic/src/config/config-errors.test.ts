import fs from 'node:fs';

import { afterEach, expect, test, vi } from 'vite-plus/test';

const search = vi.hoisted(() => vi.fn());
vi.mock('cosmiconfig', () => ({ cosmiconfigSync: () => ({ search }) }));
import Config from './index';

afterEach(() => {
  vi.restoreAllMocks();
  search.mockReset();
});

test('accepts a config returned directly by a loader', async () => {
  const config = {
    ai: { model: 'test/model' },
    groups: [],
    localeConfig: { source: 'en', target: ['fr'] },
  };
  search.mockReturnValue({ config, filepath: '/project/langnostic.config.js' });
  expect(await Config.load()).toBe(config);
});

test('returns an error when writing the default config fails', () => {
  search.mockReturnValue(null);
  const error = Error('read-only directory');
  vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
    throw error;
  });
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  expect(Config.initializeConfig()).toEqual({
    result: 'error',
    filepath: null,
  });
  expect(log).toHaveBeenCalledWith(error);
});
