import fs from 'node:fs/promises';

import { pathExists } from 'fs-extra/esm';
import type { TranslationFileMetadata, TranslationLocale } from 'langnostic';
import { writeJsonAtomic } from 'langnostic';

function compareJsonData(
  sourceJson: Record<string, string>,
  targetJson: Record<string, string> | null,
): Readonly<{
  keysToTranslate: Array<string>;
  removedKeys: Array<string>;
}> {
  if (!targetJson) {
    return {
      keysToTranslate: Object.keys(sourceJson),
      removedKeys: [],
    };
  }

  return {
    keysToTranslate: Object.keys(sourceJson).filter(
      (key) => !(key in targetJson),
    ),
    removedKeys: Object.keys(targetJson).filter((key) => !(key in sourceJson)),
  };
}

export async function processFileForChanges(
  file: TranslationFileMetadata,
  pendingUpdates: Array<() => Promise<void>> = [],
): Promise<Record<TranslationLocale, Array<string>>> {
  const sourceContent = await fs.readFile(file.source.path, 'utf8');
  const sourceJson = JSON.parse(String(sourceContent));
  const result: Record<TranslationLocale, Array<string>> = {};

  // Process each target file
  for (const target of file.targets) {
    const isFileExists = await pathExists(target.path);
    const targetContent = isFileExists
      ? await fs.readFile(target.path, 'utf8')
      : null;
    const targetJson = targetContent ? JSON.parse(targetContent) : null;
    const { keysToTranslate, removedKeys } = compareJsonData(
      sourceJson,
      targetJson,
    );

    result[target.locale] = keysToTranslate;

    // Remove keys that are no longer present in the source JSON from the target file
    if (removedKeys.length > 0) {
      removedKeys.forEach((key) => {
        delete targetJson[key];
      });
      pendingUpdates.push(() => writeJsonAtomic(target.path, targetJson));
    }
  }

  return result;
}

// Only export for testing
export const __test__ = {
  compareJsonData,
};
