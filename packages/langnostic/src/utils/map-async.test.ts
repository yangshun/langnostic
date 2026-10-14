import { describe, expect, test } from 'vite-plus/test';

import mapAsync from './map-async';

describe('mapAsync', () => {
  test('returns an empty result without calling the mapper', async () => {
    await expect(
      mapAsync([], async () => {
        throw Error('unexpected call');
      }),
    ).resolves.toEqual([]);
  });

  test('preserves input order when concurrent work completes out of order', async () => {
    const releases: Array<() => void> = [];
    const result = mapAsync(
      [1, 2, 3],
      (value) =>
        new Promise<number>((resolve) => {
          releases.push(() => resolve(value * 2));
        }),
    );
    expect(releases).toHaveLength(3);
    releases[2]();
    releases[0]();
    releases[1]();
    await expect(result).resolves.toEqual([2, 4, 6]);
  });

  test('limits concurrency and starts queued work as slots free up', async () => {
    const releases: Array<() => void> = [];
    const result = mapAsync(
      [1, 2, 3, 4],
      (value) =>
        new Promise<number>((resolve) => {
          releases.push(() => resolve(value));
        }),
      2,
    );
    expect(releases).toHaveLength(2);
    releases[0]();
    await Promise.resolve();
    expect(releases).toHaveLength(3);
    releases[1]();
    await Promise.resolve();
    expect(releases).toHaveLength(4);
    releases[2]();
    releases[3]();
    await expect(result).resolves.toEqual([1, 2, 3, 4]);
  });

  test('rejects when the mapper fails', async () => {
    const error = Error('translation failed');
    await expect(
      mapAsync([1], async () => {
        throw error;
      }),
    ).rejects.toBe(error);
  });
});
