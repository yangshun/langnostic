import { groupBy, mapValues } from 'lodash-es';

import type {
  TranslationFileMetadata,
  TranslationLocale,
  TranslationStringArg,
  TranslationStringResult,
} from '@/core/types';

/**
 * Build a map of translated content for each target locale.
 */
export function buildTranslatedContentMap(
  translatedStrings: ReadonlyArray<TranslationStringResult>,
): Map<TranslationLocale, Record<string, string>> {
  const grouped = groupBy(
    translatedStrings.flatMap(({ id, targets }) =>
      targets.map(({ locale, string }) => ({ id, locale, string })),
    ),
    'locale',
  );
  const contentMap = new Map<TranslationLocale, Record<string, string>>(
    Object.entries(
      mapValues(grouped, (translations) =>
        Object.fromEntries(translations.map(({ id, string }) => [id, string])),
      ),
    ),
  );

  return contentMap;
}

export function buildTranslationStrings(
  content: Readonly<
    Record<string, Omit<TranslationStringArg['source'], 'locale'>>
  >,
  changes: Record<TranslationLocale, ReadonlyArray<string>>,
  file: TranslationFileMetadata,
): ReadonlyArray<TranslationStringArg> {
  return Object.entries(content).reduce<Array<TranslationStringArg>>(
    (acc, [key, value]) => {
      const missingInTargets = file.targets
        .filter((target) => changes[target.locale]?.includes(key))
        .map((target) => target.locale);

      if (missingInTargets.length > 0) {
        acc.push({
          batchId: file.source.path,
          id: key,
          source: { ...value, locale: file.source.locale },
          targets: missingInTargets,
        });
      }

      return acc;
    },
    [],
  );
}
