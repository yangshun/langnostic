import chalk from 'chalk';

import type { TranslationGroupBatchStatus } from '@/core/types';

const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

const startTime = Date.now();

export function batchStatusSymbol(status: TranslationGroupBatchStatus) {
  switch (status) {
    case 'queued': {
      return chalk.grey('.');
    }
    case 'translating': {
      return spinnerFrames[
        Math.floor((Date.now() - startTime) / 80) % spinnerFrames.length
      ];
    }
    case 'success': {
      return chalk.green('✔');
    }
    case 'error': {
      return chalk.redBright('✕');
    }
  }
}
