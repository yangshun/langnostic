import fs from 'node:fs/promises';

import type {
  LangnosticPlugin,
  TranslationFileMetadata,
  TranslationStringArg,
} from 'langnostic';
import {
  buildTranslatedContentMap,
  buildTranslationStrings,
  writeJsonAtomic,
} from 'langnostic';

import { processFileForChanges } from './json-change-detector';

type TranslationEntry =
  | Readonly<{ defaultMessage: string; description: string }>
  | string;

export default function FormatJSPlugin(): LangnosticPlugin {
  const files: Array<TranslationFileMetadata> = [];
  const pendingUpdates: Array<() => Promise<void>> = [];

  return {
    async getInstructions() {
      return [
        'The strings are in ICU syntax which can contain HTML/XML tags and template values (wrapped in curly braces).',
        'Strictly DO NOT translate these HTML/XML tags and template values and just translate the UI strings around it.',
        'For languages that do not use spaces between words (e.g., Chinese, Japanese, Thai, etc.), STRICTLY REMOVE any space directly before or after JSX tags and curly braces in the string—even if the tag appears at the beginning or end of the string.',
        '✅ Example:',
        '  - English: "{title} skill plan progress"',
        '  - Correct: "{title}技能计划进度"',
        '  - ❌ Incorrect: "{title} 技能计划进度"',
        '✅ Example:',
        '  - English: "<bold>{duration}</bold> minutes"',
        '  - Correct: "<bold>{duration}</bold>分钟"',
        '  - ❌ Incorrect: <bold>{duration}</bold> 分钟',
      ].join('\n');
    },
    async getTranslationStrings() {
      pendingUpdates.length = 0;
      const translationStrings: Array<TranslationStringArg> = [];

      for (const file of files) {
        // Process file to get keys that need to be translated
        const keysToTranslate = await processFileForChanges(
          file,
          pendingUpdates,
        );

        const sourceJson = await readJson(file.source.path);
        const sourceStrings = Object.fromEntries(
          Object.entries(sourceJson).map(([id, value]) => [
            id,
            getTranslationSource(value),
          ]),
        );

        translationStrings.push(
          ...buildTranslationStrings(sourceStrings, keysToTranslate, file),
        );
      }

      return translationStrings;
    },
    async onTranslationStart() {
      for (const update of pendingUpdates.splice(0)) {
        await update();
      }
    },
    async onTranslationBatchComplete(translatedStrings) {
      if (!translatedStrings.length) {
        return;
      }

      const file = files.find(
        (file_) => file_.source.path === translatedStrings[0].batchId,
      );

      if (file == null) {
        return;
      }

      const translatedContentMap = buildTranslatedContentMap(translatedStrings);
      const sourceJson = await readJson(file.source.path);

      // Write to each target file concurrently
      const writes = await Promise.allSettled(
        file.targets.map((target) =>
          processTargetFile(target, translatedContentMap, sourceJson),
        ),
      );
      for (const write of writes) {
        if (write.status === 'rejected') {
          throw write.reason;
        }
      }
    },
    stringsPerRequest: 50,
    async trackFiles(filesMetadata) {
      // Start tracking files
      files.push(...filesMetadata);
    },
    type: 'formatjs',
  };
}

function getTranslationSource(
  value: TranslationEntry,
): Omit<TranslationStringArg['source'], 'locale'> {
  return typeof value === 'object'
    ? { description: value.description, string: value.defaultMessage }
    : { string: value };
}

function mergeTranslations(
  targetJson: Record<string, TranslationEntry>,
  translatedContent: Record<string, string>,
  sourceJson: Record<string, TranslationEntry>,
): Record<string, TranslationEntry> {
  Object.entries(translatedContent).forEach(([key, value]) => {
    targetJson[key] =
      typeof sourceJson[key] === 'object'
        ? {
            defaultMessage: value,
            description: sourceJson[key].description,
          }
        : value;
  });

  return sortKeys(targetJson);
}

function sortKeys(
  obj: Record<string, TranslationEntry>,
): Record<string, TranslationEntry> {
  return Object.keys(obj)
    .sort()
    .reduce((acc: Record<string, TranslationEntry>, key) => {
      acc[key] = obj[key];
      return acc;
    }, {});
}

async function readJson(
  path: string,
): Promise<Record<string, TranslationEntry>> {
  const content = await fs.readFile(path, 'utf8');
  return JSON.parse(content);
}

async function processTargetFile(
  target: { locale: string; path: string },
  translatedContentMap: Map<string, Record<string, string>>,
  sourceJson: Record<string, TranslationEntry>,
) {
  const targetJson = await (async () => {
    try {
      return await readJson(target.path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    return {};
  })();
  const translatedContent = translatedContentMap.get(target.locale) || {};

  const mergedContent = mergeTranslations(
    targetJson,
    translatedContent,
    sourceJson,
  );

  await writeJsonAtomic(target.path, mergedContent);
}
