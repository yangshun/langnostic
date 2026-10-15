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
  return JSON.stringify([batchId, id]);
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

    const requestedStrings = new Map(
      strings.map((string) => [
        hashStringItem(string.batchId, string.id),
        string,
      ]),
    );
    const translationStringsMap = new Map<
      BatchStringItemHash,
      Map<TranslationLocale, string>
    >();

    for (const entry of object.data) {
      const key = hashStringItem(entry.batchId, entry.id);
      const requested = requestedStrings.get(key);
      const label = `${entry.id} (${entry.batchId})`;
      if (!requested) {
        throw new Error(`Unexpected translation: ${label}`);
      }
      if (translationStringsMap.has(key)) {
        throw new Error(`Duplicate translation: ${label}`);
      }

      const translations = new Map<TranslationLocale, string>();
      for (const { locale, string } of entry.translations) {
        if (!requested.targets.includes(locale)) {
          throw new Error(`Unexpected locale ${locale} for ${label}`);
        }
        if (translations.has(locale)) {
          throw new Error(`Duplicate locale ${locale} for ${label}`);
        }
        translations.set(locale, string);
      }
      for (const locale of requested.targets) {
        if (!translations.has(locale)) {
          throw new Error(`Missing locale ${locale} for ${label}`);
        }
      }
      translationStringsMap.set(key, translations);
    }

    return strings.map((string) => {
      const translations = translationStringsMap.get(
        hashStringItem(string.batchId, string.id),
      );
      if (!translations) {
        throw new Error(
          `Missing translation: ${string.id} (${string.batchId})`,
        );
      }
      return {
        ...string,
        targets: Array.from(translations, ([locale, translation]) => ({
          locale,
          string: translation,
        })),
      };
    });
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
