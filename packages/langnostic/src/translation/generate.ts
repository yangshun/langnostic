import path from 'node:path';
import { generateObject } from 'ai';
import { z } from 'zod';

import { RUNS_PATH } from '@/core/constants';
import type {
  TranslationAI,
  TranslationGroupBatchId,
  TranslationLocale,
  TranslationRequestJob,
  TranslationStringResult,
} from '@/core/types';
import { writeFile } from '@/lib/file-service';
import { getPromptTemplate } from './prompt';

function hashStringItem(batchId: TranslationGroupBatchId, id: string): string {
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

    const { model } = ai;
    const prompt = getPromptTemplate(
      instructions || '',
      JSON.stringify(strings),
    );

    if (debug) {
      await writeFile(path.join(...filePathPrefix, 'prompt.txt'), prompt);
    }

    const result = await generateObject({
      model,
      prompt,
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
      // TODO: Allow more configuration
      temperature: 0,
    });

    if (debug) {
      await writeFile(
        path.join(...filePathPrefix, 'response.json'),
        JSON.stringify(result, null, 2),
      );
    }

    const translationStringsMap = new Map<
      string,
      Record<TranslationLocale, string>
    >();

    result.object.data.forEach((r) => {
      translationStringsMap.set(
        hashStringItem(r.batchId, r.id),
        r.translations.reduce(
          (acc: Record<string, string>, { locale, string }) => {
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
        // biome-ignore lint/style/noNonNullAssertion: TODO
        translationStringsMap.get(hashStringItem(string.batchId, string.id))!,
      ).map(([locale, translation]) => ({
        locale,
        string: translation,
      })),
    }));
  } catch (err) {
    if (debug) {
      await writeFile(
        path.join(...filePathPrefix, 'error.log'),
        (err as Error).toString(),
      );
    }
    throw err;
  }
}
