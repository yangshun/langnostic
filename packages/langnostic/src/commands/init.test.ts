import { afterEach, expect, test, vi } from 'vite-plus/test';

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
}));
vi.mock('@/config', () => ({ default: { initializeConfig: vi.fn() } }));
import { outro, spinner } from '@clack/prompts';

import Config from '@/config';

import { init } from './init';

afterEach(() => vi.restoreAllMocks());

test.each(['created', 'exists', 'error'] as const)(
  'reports config initialization result: %s',
  async (result) => {
    vi.mocked(Config.initializeConfig).mockReturnValue(
      result === 'error'
        ? { result, filepath: null }
        : { result, filepath: `${process.cwd()}/langnostic.config.ts` },
    );
    vi.mocked(outro).mockClear();
    expect(await init()).toBe(result === 'error' ? 1 : 0);
    const s = vi.mocked(spinner).mock.results.slice(-1)[0]?.value;
    expect(s.start).toHaveBeenCalledWith('Creating default configuration...');
    expect(s.stop).toHaveBeenCalledWith(
      expect.stringContaining(
        result === 'created'
          ? 'created successfully'
          : result === 'exists'
            ? 'already exists'
            : 'Error occurred',
      ),
    );
    expect(outro).toHaveBeenCalledTimes(result === 'created' ? 1 : 0);
  },
);
