import { chunk, groupBy } from 'lodash-es';

import Config from '@/config';
import { expandTargetPaths } from '@/core';
import { printGroupStatus } from '@/core/output/print';
import { TranslationGroupBatch } from '@/core/runner/translation-group-batch';
import type {
  TranslationGroup,
  TranslationGroupId,
  TranslationRequestJob,
} from '@/core/types';
import { validateFilePaths } from '@/core/validate-paths';
import { generate } from '@/translation/generate';
import mapAsync from '@/utils/map-async';

const DEFAULT_CONCURRENCY_LIMIT = 5;
const REFRESH_INTERVAL = 1000 / 16;

export async function translate({
  debug = false,
  dryRun = false,
}: Readonly<{
  debug?: boolean;
  dryRun?: boolean;
}>) {
  const { config } = new Config();
  const groups = new Map<TranslationGroupId, TranslationGroup>();
  const runId = new Date().toISOString();

  // Discover files to translate
  const discoveredGroups = await Promise.all(
    config.groups.map(async (group) => {
      const groupFiles = await Promise.all(
        group.paths.map(
          async (groupPath) =>
            await expandTargetPaths(
              group.localeConfig ?? config.localeConfig,
              groupPath,
            ),
        ),
      );

      return { group, files: groupFiles.flat() };
    }),
  );
  await validateFilePaths(discoveredGroups.flatMap(({ files }) => files));

  await Promise.all(
    discoveredGroups.map(async ({ group, files }) => {
      const { plugin } = group;
      await plugin.trackFiles(files);
      groups.set(group.name, {
        batches: new Map(),
        groupId: group.name,
        plugin,
        stringsPerRequest: group.stringsPerRequest ?? plugin.stringsPerRequest,
      });
    }),
  );

  // Gather translation strings
  await Promise.all(
    Array.from(groups.values()).map(async (group) => {
      const translationStrings = await group.plugin.getTranslationStrings();

      const batchIds = groupBy(translationStrings, (string) => string.batchId);

      Object.keys(batchIds).forEach((batchId) => {
        group.batches.set(
          batchId,
          new TranslationGroupBatch(batchId, batchIds[batchId]),
        );
      });
    }),
  );

  // Convert strings into job queue
  // Keep each job with its batch and group so execution needs no ID lookups.
  const jobQueue: Array<{
    batch: TranslationGroupBatch;
    group: TranslationGroup;
    job: TranslationRequestJob;
  }> = [];

  for (const group of groups.values()) {
    for (const batch of group.batches.values()) {
      // Split up into multiple jobs
      const chunks = chunk(batch.strings, group.stringsPerRequest);

      chunks.forEach((ch, chunkIndex) => {
        jobQueue.push({
          batch,
          group,
          job: {
            batch: batch.batchId,
            group: group.groupId,
            jobId: [
              group.groupId,
              batch.batchId.replace(/^\.\//, '').replace(/\//g, '#'),
              chunkIndex,
            ].join('-'),
            runId,
            strings: ch,
          },
        });
      });
    }
  }

  if (!dryRun) {
    await Promise.all(
      Array.from(groups.values()).map((group) =>
        group.plugin.onTranslationStart?.(),
      ),
    );
  }

  if (jobQueue.length === 0) {
    console.info('Nothing to translate. Terminating.');
    return 0;
  }

  function print() {
    printGroupStatus(groups);
  }

  if (dryRun) {
    console.info('[DRY RUN] Pending translations:\n');
    printGroupStatus(groups, { showSummary: false });
    return 0;
  }

  const intervalId = setInterval(print, REFRESH_INTERVAL);

  // Translate the strings
  try {
    await mapAsync(
      jobQueue,
      async ({ batch, group, job }) => {
        try {
          batch.startTranslating();
          const instructions = (await group.plugin.getInstructions?.()) || '';
          const translatedStrings = await generate(config.ai, job, {
            debug,
            instructions,
          });

          batch.addTranslations(translatedStrings);

          if (batch.readyToWrite) {
            await group.plugin.onTranslationBatchComplete(batch.translations);
            batch.markSuccess();
          }
        } catch (err) {
          batch.addError(err);
        }
      },
      config.concurrencyLimit ?? DEFAULT_CONCURRENCY_LIMIT,
    );
  } finally {
    clearInterval(intervalId);
  }

  printGroupStatus(groups);

  return Array.from(groups.values()).some((group) =>
    Array.from(group.batches.values()).some(
      (batch) => batch.status === 'error',
    ),
  )
    ? 1
    : 0;
}
