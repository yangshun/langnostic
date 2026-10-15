import { afterEach, beforeEach, expect, test, vi } from 'vite-plus/test';

import { generate } from '@/translation/generate';

import { resolveAI } from './ai';
import type { AIConfig, AIProvider } from './types';

const providers: Array<AIProvider> = [
  'openai',
  'anthropic',
  'google',
  'openai-compatible',
];
const data = [
  {
    batchId: 'en.json',
    id: 'hello',
    translations: [{ locale: 'fr', string: 'Bonjour' }],
  },
];
const job = {
  runId: 'provider-test',
  jobId: 'hello',
  group: 'app',
  batch: 'en.json',
  strings: [
    {
      batchId: 'en.json',
      id: 'hello',
      source: { locale: 'en', string: 'Hello' },
      targets: ['fr'],
    },
  ],
};
const endpoints = {
  openai: 'https://api.openai.com/v1/responses',
  anthropic: 'https://api.anthropic.com/v1/messages',
  google:
    'https://generativelanguage.googleapis.com/v1beta/models/future-model:generateContent',
  'openai-compatible': 'http://localhost:1234/v1/chat/completions',
};
const apiKeys = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GOOGLE_GENERATIVE_AI_API_KEY',
};

function response(provider: AIProvider, body: Record<string, any>) {
  const text = JSON.stringify({ data });
  switch (provider) {
    case 'openai':
      return {
        id: 'response',
        model: body.model,
        created_at: 1,
        output: [
          {
            type: 'message',
            id: 'message',
            role: 'assistant',
            content: [{ type: 'output_text', text, annotations: [] }],
          },
        ],
        usage: { input_tokens: 1, output_tokens: 1 },
      };
    case 'anthropic':
      return {
        id: 'message',
        type: 'message',
        role: 'assistant',
        model: body.model,
        content: body.tools
          ? [{ type: 'tool_use', id: 'json', name: 'json', input: { data } }]
          : [{ type: 'text', text }],
        stop_reason: body.tools ? 'tool_use' : 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      };
    case 'google':
      return {
        candidates: [
          {
            content: { role: 'model', parts: [{ text }] },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: {
          promptTokenCount: 1,
          candidatesTokenCount: 1,
          totalTokenCount: 2,
        },
      };
    case 'openai-compatible':
      return {
        id: 'chat',
        model: body.model,
        created: 1,
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: text },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      };
  }
}

function mockAPI(provider: AIProvider) {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockImplementation(async (_url, init) => {
      const body = JSON.parse(init!.body as string);
      return Response.json(response(provider, body));
    });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

beforeEach(() => {
  vi.stubEnv('ANTHROPIC_BASE_URL', undefined);
  vi.stubEnv('OPENAI_BASE_URL', undefined);
  for (const name of Object.values(apiKeys)) vi.stubEnv(name, 'default-key');
  // Fail locally if a test forgets to install its mock response.
  vi.stubGlobal(
    'fetch',
    vi.fn().mockRejectedValue(Error('Unexpected HTTP request')),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

test.each(providers)('accepts arbitrary model IDs for %s', (provider) => {
  expect(
    resolveAI({
      provider,
      model: 'brand-new/model-id',
      baseURL: 'http://localhost:1234/v1',
    }).model,
  ).toMatchObject({
    modelId: 'brand-new/model-id',
    specificationVersion: 'v4',
  });
});

test.each(providers)(
  'uses the %s API, default credentials, and structured translation output',
  async (provider) => {
    const fetch = mockAPI(provider);
    const ai = resolveAI({
      provider,
      model: 'future-model',
      ...(provider === 'openai-compatible'
        ? { baseURL: 'http://localhost:1234/v1' }
        : {}),
      temperature: 0.2,
      topP: 0.9,
    });
    const result = await generate(ai, job, {});
    expect(result[0].targets).toEqual(data[0].translations);
    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toBe(endpoints[provider]);
    expect(init!.method).toBe('POST');
    const headers = new Headers(init!.headers);
    if (provider === 'anthropic') {
      expect(headers.get('x-api-key')).toBe('default-key');
      expect(headers.get('anthropic-version')).toBe('2023-06-01');
    } else if (provider === 'google') {
      expect(headers.get('x-goog-api-key')).toBe('default-key');
    } else {
      expect(headers.get('authorization')).toBe(
        provider === 'openai' ? 'Bearer default-key' : null,
      );
    }
    const body = JSON.parse(init!.body as string);
    expect(JSON.stringify(body)).toContain('Hello');
    expect(body.model ?? 'future-model').toBe('future-model');
    switch (provider) {
      case 'openai':
        expect(body.text.format).toMatchObject({
          type: 'json_schema',
          strict: true,
          schema: { properties: { data: { type: 'array' } } },
        });
        expect(body).toMatchObject({ temperature: 0.2, top_p: 0.9 });
        break;
      case 'anthropic':
        expect(body.tools[0]).toMatchObject({
          name: 'json',
          input_schema: { properties: { data: { type: 'array' } } },
        });
        expect(body.tool_choice).toMatchObject({ type: 'any' });
        expect(body).toMatchObject({ temperature: 0.2, top_p: 0.9 });
        break;
      case 'google':
        expect(body.generationConfig).toMatchObject({
          temperature: 0.2,
          topP: 0.9,
          responseMimeType: 'application/json',
          responseJsonSchema: { properties: { data: { type: 'array' } } },
        });
        break;
      case 'openai-compatible':
        expect(body.response_format).toMatchObject({
          type: 'json_schema',
          json_schema: {
            strict: true,
            schema: { properties: { data: { type: 'array' } } },
          },
        });
        expect(body).toMatchObject({ temperature: 0.2, top_p: 0.9 });
        break;
    }
  },
);

test.each(providers)(
  'forwards native parameters, endpoint overrides and environment references through %s',
  async (provider) => {
    const fetch = mockAPI(provider);
    vi.stubEnv('LANGNOSTIC_KEY', 'custom-key');
    vi.stubEnv('LANGNOSTIC_PROJECT', 'project-value');
    const native = {
      openai: {
        reasoning: { effort: 'low' },
        text: { verbosity: 'low', format: { type: 'text' } },
        input: [],
        instructions: 'replaced',
      },
      anthropic: {
        thinking: { type: 'disabled' },
        output_config: { effort: 'low', format: { type: 'text' } },
        messages: [],
        system: 'replaced',
      },
      google: {
        generationConfig: {
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: 'text/plain',
          responseJsonSchema: null,
        },
        contents: [],
        systemInstruction: 'replaced',
      },
      'openai-compatible': {
        reasoning_effort: 'low',
        messages: [],
        response_format: { type: 'text' },
      },
    };
    const config: AIConfig = {
      provider,
      model: 'claude-sonnet-4-5',
      baseURL: 'https://custom.example/v1/',
      apiKey: { env: 'LANGNOSTIC_KEY' },
      headers: {
        'X-Project': { env: 'LANGNOSTIC_PROJECT' },
        'X-Literal': 'literal',
      },
      parameters: {
        ...native[provider],
        model: 'replaced',
        stream: true,
        tools: [],
        ...(provider === 'google'
          ? { toolConfig: {} }
          : { tool_choice: 'none' }),
        metadata: { project: { env: 'LANGNOSTIC_PROJECT' } },
        custom: [null, 1, true],
      },
    };
    await generate(resolveAI(config), job, {});
    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toBe(
      {
        openai: 'https://custom.example/v1/responses',
        anthropic: 'https://custom.example/v1/messages',
        google:
          'https://custom.example/v1/models/claude-sonnet-4-5:generateContent',
        'openai-compatible': 'https://custom.example/v1/chat/completions',
      }[provider],
    );
    const headers = new Headers(init!.headers);
    expect(headers.get('x-project')).toBe('project-value');
    expect(headers.get('x-literal')).toBe('literal');
    expect(
      headers.get(
        provider === 'anthropic'
          ? 'x-api-key'
          : provider === 'google'
            ? 'x-goog-api-key'
            : 'authorization',
      ),
    ).toBe(
      provider === 'openai' || provider === 'openai-compatible'
        ? 'Bearer custom-key'
        : 'custom-key',
    );
    const body = JSON.parse(init!.body as string);
    expect(body.model ?? config.model).toBe(config.model);
    expect(body.stream).not.toBe(true);
    expect(body.tools).toBeUndefined();
    expect(body.tool_choice).toBeUndefined();
    expect(JSON.stringify(body)).toContain('Hello');
    expect(body).toMatchObject({
      metadata: { project: 'project-value' },
      custom: [null, 1, true],
    });
    switch (provider) {
      case 'openai':
        expect(body).toMatchObject({
          reasoning: { effort: 'low' },
          text: {
            verbosity: 'low',
            format: { type: 'json_schema', schema: { type: 'object' } },
          },
        });
        expect(body.instructions).toBeUndefined();
        break;
      case 'anthropic':
        expect(body).toMatchObject({
          thinking: { type: 'disabled' },
          output_config: {
            effort: 'low',
            format: { type: 'json_schema', schema: { type: 'object' } },
          },
        });
        expect(body.system).toBeUndefined();
        break;
      case 'google':
        expect(body.generationConfig).toMatchObject({
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: 'application/json',
          responseJsonSchema: { type: 'object' },
        });
        expect(body.systemInstruction).toBeUndefined();
        break;
      case 'openai-compatible':
        expect(body).toMatchObject({
          reasoning_effort: 'low',
          response_format: {
            type: 'json_schema',
            json_schema: { schema: { type: 'object' } },
          },
        });
        break;
    }
  },
);

test.each(['apiKey', 'headers', 'parameters'] as const)(
  'reports unset environment references at ai.%s',
  (field) => {
    vi.stubEnv('LANGNOSTIC_MISSING', undefined);
    const reference = { env: 'LANGNOSTIC_MISSING' };
    expect(() =>
      resolveAI({
        provider: 'openai',
        model: 'model',
        [field]: field === 'apiKey' ? reference : { nested: reference },
      }),
    ).toThrow(
      `ai.${field}${field === 'apiKey' ? '' : '.nested'}: Environment variable LANGNOSTIC_MISSING is not set`,
    );
  },
);

test('keeps literal credentials, headers and parameters as plain values', async () => {
  const fetch = mockAPI('openai-compatible');
  await generate(
    resolveAI({
      provider: 'openai-compatible',
      model: 'local',
      baseURL: 'http://localhost:1234/v1',
      apiKey: 'literal-key',
      temperature: 0.2,
      headers: { 'X-Literal': '${NOT_INTERPOLATED}' },
      parameters: { max_tokens: 100, temperature: 0.7 },
    }),
    job,
    {},
  );
  expect(new Headers(fetch.mock.calls[0][1]!.headers).get('x-literal')).toBe(
    '${NOT_INTERPOLATED}',
  );
  expect(JSON.parse(fetch.mock.calls[0][1]!.body as string).max_tokens).toBe(
    100,
  );
  expect(JSON.parse(fetch.mock.calls[0][1]!.body as string).temperature).toBe(
    0.7,
  );
});

test('preserves the Anthropic JSON tool schema for arbitrary model IDs with native parameters', async () => {
  const fetch = mockAPI('anthropic');
  await generate(
    resolveAI({
      provider: 'anthropic',
      model: 'custom-model',
      parameters: {
        max_tokens: 1000,
        tools: [],
        tool_choice: { type: 'none' },
        output_config: { format: { type: 'text' } },
      },
    }),
    job,
    {},
  );
  const body = JSON.parse(fetch.mock.calls[0][1]!.body as string);
  expect(body.tools).toMatchObject([
    {
      name: 'json',
      input_schema: { type: 'object', properties: { data: { type: 'array' } } },
    },
  ]);
  expect(body.tool_choice).toMatchObject({
    type: 'any',
    disable_parallel_tool_use: true,
  });
  expect(body.output_config).toEqual({});
  expect(body.max_tokens).toBe(1000);
});
