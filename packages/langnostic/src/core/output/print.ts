import chalk from 'chalk';
import logUpdate from 'log-update';

import type { TranslationGroupId, TranslationGroups } from '@/core/types';

import { batchStatusSymbol } from './spinner-frames';

const timeStart = Date.now();

export function formatDuration(duration: number | null) {
  return duration == null ? '' : `${(duration / 1000).toFixed(1)}s`;
}

function formatGroupId(groupId: TranslationGroupId) {
  return `[${groupId}]`;
}

export function printGroupStatus(
  groups: TranslationGroups,
  { showSummary = true } = {},
) {
  const longestGroupIdLength = Math.max(
    ...Array.from(groups.keys()).map((name) => formatGroupId(name).length),
  );

  const results: Array<string> = [];
  let completedBatches = 0;
  let failedBatches = 0;
  let totalBatches = 0;

  for (const group of groups.values()) {
    for (const batch of group.batches.values()) {
      const batchPrefix =
        chalk.dim(formatGroupId(group.groupId).padStart(longestGroupIdLength)) +
        ` ${batch.batchId.replace(/^\.\//, '')}`;

      if (batch.status === 'success') {
        completedBatches++;
      }
      if (batch.status === 'error') {
        failedBatches++;
      }
      totalBatches++;

      results.push(
        [
          batchStatusSymbol(batch.status),
          batchPrefix,
          chalk.dim(
            `(${batch.strings.length} ${batch.strings.length === 1 ? 'string' : 'strings'})`,
          ),
          chalk.dim(formatDuration(batch.duration)),
        ].join(' '),
      );
      for (const error of batch.errors) {
        results.push(`  ${chalk.red(error.message)}`);
      }
    }
  }

  if (showSummary) {
    results.push(
      '',
      [
        `${chalk.bold('Batches:')} `,
        `${chalk.bold.green(`${completedBatches} successful`)},`,
        `${chalk.bold.red(`${failedBatches} failed`)},`,
        `${totalBatches} total`,
      ].join(' '),
      `${chalk.bold('Duration:')} ${formatDuration(Date.now() - timeStart)}`,
    );
  }

  logUpdate(results.join('\n'));
}
