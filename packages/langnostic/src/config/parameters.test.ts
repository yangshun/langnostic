import { afterEach, expect, test, vi } from 'vite-plus/test';

import { createProviderFetch } from './parameters';

afterEach(() => vi.unstubAllGlobals());

test('leaves the native fetch implementation in place without parameters', () => {
  expect(createProviderFetch('openai', undefined)).toBeUndefined();
});

test('merges nested body additions and preserves HTTP metadata without mutating inputs', async () => {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValue(Response.json({}));
  vi.stubGlobal('fetch', fetch);
  const parameters = JSON.parse(
    '{"text":{"verbosity":"low","format":null},"nested":{"new":true},"scalar":{"new":true},"array":[1,null],"nullable":null,"__proto__":{"safe":true}}',
  );
  const body = {
    model: 'original',
    input: ['prompt'],
    text: { format: { type: 'json_schema' } },
    nested: { old: true },
    scalar: 1,
    array: [0],
  };
  const init = {
    body: JSON.stringify(body),
    method: 'POST',
    headers: { 'X-Trace': 'value' },
    signal: new AbortController().signal,
  };
  await createProviderFetch('openai', parameters)!(
    'https://example.com/responses',
    init,
  );
  const [url, request] = fetch.mock.calls[0];
  expect(url).toBe('https://example.com/responses');
  expect(request).toMatchObject({
    method: 'POST',
    headers: init.headers,
    signal: init.signal,
  });
  const merged = JSON.parse(request!.body as string);
  expect(merged).toEqual({
    ...body,
    text: { ...body.text, verbosity: 'low' },
    nested: { old: true, new: true },
    scalar: { new: true },
    array: [1, null],
    nullable: null,
    ['__proto__']: { safe: true },
  });
  expect(Object.getPrototypeOf(merged)).toBe(Object.prototype);
  expect(body.text).toEqual({ format: { type: 'json_schema' } });
  expect(parameters.text.format).toBeNull();
});

test.each([null, [], 'replace', 1])(
  'preserves schemas when an ancestor is replaced with %j',
  async (text) => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(Response.json({}));
    vi.stubGlobal('fetch', fetch);
    const body = { text: { format: { type: 'json_schema' } } };
    await createProviderFetch('openai', { text })!('https://example.com', {
      body: JSON.stringify(body),
    });
    expect(JSON.parse(fetch.mock.calls[0][1]!.body as string)).toEqual(body);
  },
);

test('cannot introduce an alternate output format when its parent is absent', async () => {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValue(Response.json({}));
  vi.stubGlobal('fetch', fetch);
  await createProviderFetch('google', {
    generationConfig: { responseSchema: {}, responseFormat: 'text' },
  })!('https://example.com', { body: '{}' });
  expect(JSON.parse(fetch.mock.calls[0][1]!.body as string)).toEqual({
    generationConfig: {},
  });
});
