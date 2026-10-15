import { afterEach, expect, test, vi } from 'vite-plus/test';

vi.mock('dotenv', () => ({ config: vi.fn() }));
vi.mock('./commands/init', () => ({ init: vi.fn(async () => 0) }));
vi.mock('./commands/translate', () => ({ translate: vi.fn(async () => 0) }));
import { config } from 'dotenv';

import { init } from './commands/init';
import { translate } from './commands/translate';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

test.each([
  ['init'],
  ['init', '--format', 'json'],
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
  expect(process.exitCode).toBe(0);
  expect(config).toHaveBeenCalledOnce();
  if (args[0] === 'init') {
    expect(init).toHaveBeenCalledOnce();
    expect(init).toHaveBeenCalledWith({
      format: args.length > 1 ? 'json' : 'ts',
    });
  } else {
    expect(translate).toHaveBeenCalledWith(
      expect.objectContaining({
        debug: args.length > 1,
        dryRun: args.length > 1,
      }),
    );
  }
});

test.each([Error('invalid config'), 'discovery failed'])(
  'reports command failures and returns a nonzero exit code: %s',
  async (error) => {
    vi.resetModules();
    vi.stubGlobal('process', {
      ...process,
      argv: ['node', 'langnostic', 'translate'],
    });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(translate).mockRejectedValueOnce(error);
    await import('./cli');
    expect(process.exitCode).toBe(1);
    expect(log).toHaveBeenCalledWith(
      error instanceof Error ? error.message : error,
    );
  },
);

test('propagates a failed translation result', async () => {
  vi.resetModules();
  vi.stubGlobal('process', {
    ...process,
    argv: ['node', 'langnostic', 'translate'],
  });
  vi.mocked(translate).mockResolvedValueOnce(1);
  await import('./cli');
  expect(process.exitCode).toBe(1);
});
