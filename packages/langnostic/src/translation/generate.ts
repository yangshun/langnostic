import path from 'node:path';

import { generateText, Output } from 'ai';
import { outputFile, outputJson } from 'fs-extra/esm';
import { z } from 'zod';

import { RUNS_PATH } from '@/core/constants';
import type {
  TranslationAI,
  TranslationGroupBatchId,
  TranslationLocale,
  TranslationRequestJob,
  TranslationStringResult,
} from '@/core/types';

import { getPromptTemplate } from './prompt';

type BatchStringItemHash = string;
function hashStringItem(
  batchId: TranslationGroupBatchId,
  id: string,
): BatchStringItemHash {
  return `${batchId}#${id}`;
}

export async function generate(
  ai: TranslationAI,
  job: TranslationRequestJob,
  options: Readonly<{
    debug?: boolean;
    instructions?: string;
  }>,
): Promise<ReadonlyArray<TranslationStringResult>> {
  const { jobId, runId, strings } = job;
  const { debug, instructions } = options;
  const filePathPrefix = [RUNS_PATH, runId, jobId];

  try {
    if (strings.length === 0) {
      console.info('No strings to translate');

      return [];
    }

    const { model, ...aiOptions } = ai;
    const prompt = getPromptTemplate(
      instructions || '',
      JSON.stringify(strings),
    );

    if (debug) {
      await outputFile(path.join(...filePathPrefix, 'prompt.txt'), prompt);
    }

    const result = await generateText({
      model,
      prompt,
      // TODO: Add system prompt
      output: Output.object({
        schema: z.object({
          data: z.array(
            z.object({
              batchId: z.string(),
              id: z.string(),
              translations: z.array(
                z.object({
                  locale: z.string(),
                  string: z.string(),
                }),
              ),
            }),
          ),
        }),
      }),
      include: debug ? { requestBody: true, responseBody: true } : undefined,
      ...aiOptions,
    });
    const object = result.output;

    if (debug) {
      await outputJson(
        path.join(...filePathPrefix, 'response.json'),
        {
          object,
          finishReason: result.finishReason,
          usage: result.usage,
          warnings: result.warnings,
          providerMetadata: result.finalStep.providerMetadata,
          response: result.finalStep.response,
          request: result.finalStep.request,
          reasoning: result.finalStep.reasoningText,
        },
        { spaces: 2 },
      );
    }

    const translationStringsMap = new Map<
      BatchStringItemHash,
      Record<TranslationLocale, string>
    >();

    object.data.forEach((r) => {
      translationStringsMap.set(
        hashStringItem(r.batchId, r.id),
        r.translations.reduce(
          (acc: Record<TranslationLocale, string>, { locale, string }) => {
            acc[locale] = string;
            return acc;
          },
          {},
        ),
      );
    });

    return strings.map((string) => ({
      ...string,
      targets: Object.entries(
        // TODO: report if there are missing results from the LLM
        // oxlint-ignore typescript/no-non-null-assertion -- TODO
        translationStringsMap.get(hashStringItem(string.batchId, string.id))!,
      ).map(([locale, translation]) => ({
        locale,
        string: translation,
      })),
    }));
  } catch (err) {
    if (debug) {
      await outputFile(
        path.join(...filePathPrefix, 'error.log'),
        (err as Error).toString(),
      );
    }

    throw err;
  }
}
