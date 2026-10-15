import { randomUUID } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';

import { NoObjectGeneratedError } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { afterAll, describe, expect, test, vi } from 'vite-plus/test';

import { RUNS_PATH } from '@/core/constants';
import type { TranslationRequestJob } from '@/core/types';

import { generate } from './generate';
import { getPromptTemplate } from './prompt';

const runId = `sdk-generation-test-${randomUUID()}`;
const job: TranslationRequestJob = {
  batch: 'file-a.json',
  group: 'app',
  jobId: 'translations',
  runId,
  strings: [
    {
      batchId: 'file-a.json',
      id: 'greeting',
      source: {
        description: 'A common greeting',
        locale: 'en-US',
        string: 'Hello',
      },
      targets: ['pt-BR', 'zh-CN'],
    },
    {
      batchId: 'file-b.json',
      id: 'greeting',
      source: { locale: 'en-US', string: 'Welcome' },
      targets: ['pt-BR'],
    },
  ],
};
const output = {
  data: [
    {
      batchId: 'file-b.json',
      id: 'greeting',
      translations: [{ locale: 'pt-BR', string: 'Bem-vindo' }],
    },
    {
      batchId: 'file-a.json',
      id: 'greeting',
      translations: [
        { locale: 'pt-BR', string: 'Olá' },
        { locale: 'zh-CN', string: '你好' },
      ],
    },
  ],
};

function mockModel(responseObject: unknown) {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: 'text', text: JSON.stringify(responseObject) }],
      finishReason: { unified: 'stop', raw: 'STOP' },
      usage: {
        inputTokens: {
          total: 12,
          noCache: 12,
          cacheRead: undefined,
          cacheWrite: undefined,
        },
        outputTokens: { total: 5, text: 5, reasoning: undefined },
      },
      request: { body: 'mock request body' },
      response: {
        id: 'mock-response',
        modelId: 'mock-model',
        timestamp: new Date('2026-01-01T00:00:00.000Z'),
        body: { debug: 'mock response body' },
      },
      providerMetadata: { google: { debug: 'mock metadata' } },
      warnings: [],
    }),
  });
}

describe('generate', () => {
  afterAll(async () => {
    await rm(path.join(RUNS_PATH, runId), { force: true, recursive: true });
  });

  test('validates structured translations, forwards AI options, and matches batch identities', async () => {
    const model = mockModel(output);
    const providerOptions = {
      google: { thinkingConfig: { thinkingBudget: 0 } },
    };
    const instructions = 'Preserve inline markup.';

    await expect(
      generate({ model, providerOptions, temperature: 0.2, topP: 0.9 }, job, {
        instructions,
      }),
    ).resolves.toEqual([
      {
        ...job.strings[0],
        targets: [
          { locale: 'pt-BR', string: 'Olá' },
          { locale: 'zh-CN', string: '你好' },
        ],
      },
      {
        ...job.strings[1],
        targets: [{ locale: 'pt-BR', string: 'Bem-vindo' }],
      },
    ]);
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(model.doGenerateCalls[0]).toMatchObject({
      providerOptions,
      temperature: 0.2,
      topP: 0.9,
      responseFormat: { type: 'json', schema: { type: 'object' } },
      prompt: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: getPromptTemplate(
                instructions,
                JSON.stringify(job.strings),
              ),
            },
          ],
        },
      ],
    });
  });

  test('keeps structured output, token usage, and provider bodies in debug logs', async () => {
    const debugJob = { ...job, jobId: 'debug-translations' };
    const directory = path.join(RUNS_PATH, runId, debugJob.jobId);

    await generate({ model: mockModel(output) }, debugJob, { debug: true });

    expect(await readFile(path.join(directory, 'prompt.txt'), 'utf8')).toBe(
      getPromptTemplate('', JSON.stringify(job.strings)),
    );
    expect(
      JSON.parse(await readFile(path.join(directory, 'response.json'), 'utf8')),
    ).toMatchObject({
      object: output,
      finishReason: 'stop',
      usage: { inputTokens: 12, outputTokens: 5, totalTokens: 17 },
      request: { body: 'mock request body' },
      response: { id: 'mock-response', body: { debug: 'mock response body' } },
      providerMetadata: { google: { debug: 'mock metadata' } },
    });
  });

  test('rejects invalid translation output and writes the debug error', async () => {
    const invalidJob = { ...job, jobId: 'invalid-translations' };
    const model = mockModel({
      data: [
        {
          batchId: 'file-a.json',
          id: 'greeting',
          translations: [{ locale: 'pt-BR', string: 123 }],
        },
      ],
    });

    await expect(
      generate({ model }, invalidJob, { debug: true }),
    ).rejects.toThrowError(NoObjectGeneratedError);
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(
      await readFile(
        path.join(RUNS_PATH, runId, invalidJob.jobId, 'error.log'),
        'utf8',
      ),
    ).toContain('No object generated');

    await expect(generate({ model }, invalidJob, {})).rejects.toThrowError(
      NoObjectGeneratedError,
    );
  });

  test('skips generation for an empty batch', async () => {
    const model = mockModel(output);
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});

    try {
      await expect(
        generate({ model }, { ...job, strings: [] }, {}),
      ).resolves.toEqual([]);
      expect(model.doGenerateCalls).toHaveLength(0);
      expect(info).toHaveBeenCalledWith('No strings to translate');
    } finally {
      info.mockRestore();
    }
  });

  test.each([
    [{ data: [] }, 'Missing translation: greeting (file-a.json)'],
    [{ data: [output.data[0]] }, 'Missing translation: greeting (file-a.json)'],
    [{ data: [output.data[1]] }, 'Missing translation: greeting (file-b.json)'],
    [{ data: [...output.data, output.data[0]] }, 'Duplicate translation'],
    [
      { data: [{ ...output.data[0], batchId: 'unknown' }] },
      'Unexpected translation',
    ],
    [
      { data: [{ ...output.data[0], id: 'unknown' }] },
      'Unexpected translation',
    ],
    [
      { data: [{ ...output.data[1], translations: [] }] },
      'Missing locale pt-BR',
    ],
    [
      {
        data: [
          { ...output.data[1], translations: [output.data[1].translations[0]] },
        ],
      },
      'Missing locale zh-CN',
    ],
    [
      {
        data: [
          {
            ...output.data[0],
            translations: [{ locale: 'fr', string: 'Bonjour' }],
          },
        ],
      },
      'Unexpected locale fr',
    ],
    [
      {
        data: [
          {
            ...output.data[0],
            translations: [
              output.data[0].translations[0],
              output.data[0].translations[0],
            ],
          },
        ],
      },
      'Duplicate locale pt-BR',
    ],
  ])(
    'rejects incomplete or ambiguous results: %s',
    async (response, message) => {
      await expect(
        generate({ model: mockModel(response) }, job, {}),
      ).rejects.toThrow(message);
    },
  );

  test('keeps batch and string identities distinct when IDs contain separators', async () => {
    const collisionJob = {
      ...job,
      strings: [
        { ...job.strings[1], batchId: 'file#a', id: 'b' },
        { ...job.strings[1], batchId: 'file', id: 'a#b' },
      ],
    };
    const data = collisionJob.strings.map((string, index) => ({
      batchId: string.batchId,
      id: string.id,
      translations: [{ locale: 'pt-BR', string: `Translation ${index}` }],
    }));
    const result = await generate(
      { model: mockModel({ data }) },
      collisionJob,
      {},
    );
    expect(result.map((string) => string.targets[0].string)).toEqual([
      'Translation 0',
      'Translation 1',
    ]);
  });
});
