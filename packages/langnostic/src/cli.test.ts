import { afterEach, expect, test, vi } from 'vite-plus/test';

vi.mock('dotenv', () => ({ config: vi.fn() }));
vi.mock('./commands/init', () => ({ init: vi.fn() }));
vi.mock('./commands/translate', () => ({ translate: vi.fn() }));
import { config } from 'dotenv';

import { init } from './commands/init';
import { translate } from './commands/translate';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

test.each([
  ['init'],
  ['translate'],
  ['translate', '--debug', '--dry-run'],
  ['translate', '-d', '-r'],
])('dispatches CLI arguments %j', async (...args) => {
  vi.resetModules();
  vi.stubGlobal('process', {
    ...process,
    argv: ['node', 'langnostic', ...args],
  });
  await import('./cli');
  expect(config).toHaveBeenCalledOnce();
  if (args[0] === 'init') {
    expect(init).toHaveBeenCalledOnce();
  } else {
    expect(translate).toHaveBeenCalledWith(
      expect.objectContaining({
        debug: args.length > 1,
        dryRun: args.length > 1,
      }),
    );
  }
});
