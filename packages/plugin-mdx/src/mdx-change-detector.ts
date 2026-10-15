import fs from 'node:fs/promises';

import fse from 'fs-extra';
import grayMatter from 'gray-matter';
import type {
  TranslationFileItem,
  TranslationFileMetadata,
  TranslationLocale,
} from 'langnostic';
import { isEqual } from 'lodash-es';

import type { PluginOptions } from '.';
import {
  buildTargetMDXContent,
  buildTargetMDXFrontmatter,
  generateHash,
  generateMDXContentHashList,
  getFrontmatterWithoutExcludedKeys,
} from './mdx-file';
import registryManager, { type Registry } from './registry-manager';

type DiffResult = Readonly<{
  isReorderOrRemoval: boolean;
  keysToTranslate: ReadonlyArray<string>;
}>;

// Checks if all elements in source are present in target
function isSubset(
  source: ReadonlyArray<string>,
  target: ReadonlyArray<string>,
) {
  const targetSet = new Set(target);

  return source.every((item) => targetSet.has(item));
}

function findMissingOrUpdatedFrontmatterKeys(
  sourceFrontmatter: Record<string, string>,
  targetFrontmatter: Record<string, string>,
  registryFrontmatter: Record<string, string>,
): ReadonlyArray<string> {
  return Object.keys(sourceFrontmatter).filter((key) => {
    // If key is not present in target frontmatter, it needs translation
    if (!(key in targetFrontmatter)) {
      return true;
    }

    const sourceHash = generateHash(sourceFrontmatter[key]);

    // If hash value is different, it needs translation
    return sourceHash !== registryFrontmatter[key];
  });
}

function findFrontmatterExcludedKeysToUpdate(
  excludeKeys: ReadonlyArray<string>,
  sourceFrontmatter: Record<string, string>,
  targetFrontmatter: Record<string, string>,
): ReadonlyArray<string> {
  return excludeKeys.filter(
    (key) =>
      (key in targetFrontmatter && !(key in sourceFrontmatter)) ||
      (!(key in targetFrontmatter) && key in sourceFrontmatter) ||
      sourceFrontmatter[key] !== targetFrontmatter[key],
  );
}

function detectFrontmatterDiff(
  sourceFrontmatter: Record<string, string>,
  targetFrontmatter: Record<string, string> | undefined,
  registryFrontmatter: Record<string, string>,
): DiffResult {
  const effectiveTarget = targetFrontmatter || {};
  const keysToTranslate = findMissingOrUpdatedFrontmatterKeys(
    sourceFrontmatter,
    effectiveTarget,
    registryFrontmatter,
  );

  const sourceHashes = Object.values(sourceFrontmatter).map(generateHash);
  const registryHashes = Object.values(registryFrontmatter);
  const isSourceSubset = isSubset(sourceHashes, registryHashes);

  const isReorderOrRemoval =
    isSourceSubset &&
    keysToTranslate.length === 0 &&
    Object.keys(sourceFrontmatter).length <
      Object.keys(registryFrontmatter).length;

  return { isReorderOrRemoval, keysToTranslate };
}

function findMissingOrUpdatedContentKeys(
  sourceHashList: ReadonlyArray<string>,
  targetHashList: ReadonlyArray<string>,
  registryTargetHashList: ReadonlyArray<string>,
): ReadonlyArray<string> {
  // If the target hash list is different from the registry hash list, all keys need to be translated
  if (targetHashList.length !== registryTargetHashList.length) {
    return sourceHashList;
  }

  return sourceHashList.filter((key) => !registryTargetHashList.includes(key));
}

function detectContentDiff(
  sourceHashList: ReadonlyArray<string>,
  targetHashList: ReadonlyArray<string> | undefined,
  registryHashList: ReadonlyArray<string>,
): DiffResult {
  const effectiveTarget = targetHashList || [];
  const keysToTranslate = targetHashList
    ? findMissingOrUpdatedContentKeys(
        sourceHashList,
        effectiveTarget,
        registryHashList,
      )
    : sourceHashList;

  if (keysToTranslate.length > 0) {
    return { isReorderOrRemoval: false, keysToTranslate };
  }

  const isSourceSubset = isSubset(sourceHashList, registryHashList);
  const isReorderOrRemoval =
    isSourceSubset && !isEqual(sourceHashList, registryHashList);

  return { isReorderOrRemoval, keysToTranslate };
}

export async function processFileForChanges(
  file: TranslationFileMetadata,
  options?: PluginOptions,
  pendingUpdates: Array<() => Promise<void>> = [],
): Promise<{
  content: Record<TranslationLocale, ReadonlyArray<string>>;
  frontmatter: Record<TranslationLocale, ReadonlyArray<string>>;
}> {
  const { frontmatterExcludedKeys } = options || {};
  const registry = registryManager();
  const registryData = await registry.load(file.source.path);

  const result: {
    content: Record<TranslationLocale, ReadonlyArray<string>>;
    frontmatter: Record<TranslationLocale, ReadonlyArray<string>>;
  } = { content: {}, frontmatter: {} };

  const registryUpdatedMDXContent: Record<
    TranslationLocale,
    Array<string>
  > = {};
  let registryUpdatedFrontmatter: Record<string, string> | null = null;

  const sourceContent = await fs.readFile(file.source.path, 'utf8');
  const { content: sourceMDXContent, data: sourceFrontmatter } =
    grayMatter(sourceContent);
  const sourceHashList = generateMDXContentHashList(sourceMDXContent);
  const cleanSourceFrontmatter =
    frontmatterExcludedKeys && frontmatterExcludedKeys?.length > 0
      ? getFrontmatterWithoutExcludedKeys(
          sourceFrontmatter,
          frontmatterExcludedKeys,
        )
      : sourceFrontmatter;

  await Promise.all(
    file.targets.map(async (target) => {
      {
        const targetExists = await fse.pathExists(target.path);
        const targetContent = targetExists
          ? await fs.readFile(target.path, 'utf8')
          : null;

        const { content: targetMDXContent, data: targetFrontmatter } =
          targetContent ? grayMatter(targetContent) : { content: '', data: {} };

        const contentDiff = detectContentDiff(
          sourceHashList,
          targetExists
            ? generateMDXContentHashList(targetMDXContent)
            : undefined,
          registryData.content.targets?.[target.locale] || [],
        );

        const frontmatterDiff = detectFrontmatterDiff(
          cleanSourceFrontmatter,
          targetFrontmatter,
          registryData.frontmatter,
        );

        const rebuiltContent = rebuildTargetContent({
          contentDiff,
          frontmatterDiff,
          frontmatterExcludedKeys,
          registryData,
          sourceFrontmatter,
          sourceMDXContent,
          target,
          targetFrontmatter,
          targetMDXContent,
        });
        if (rebuiltContent !== undefined) {
          pendingUpdates.push(() =>
            fse.outputFile(target.path, rebuiltContent, 'utf8'),
          );
        }

        // Update registry state
        if (frontmatterDiff.isReorderOrRemoval) {
          registryUpdatedFrontmatter = Object.keys(
            cleanSourceFrontmatter,
          ).reduce(
            (acc, key) => {
              // A removal-only diff has already verified these source hashes.
              acc[key] = registryData.frontmatter[key];

              return acc;
            },
            {} as Record<string, string>,
          );
        }

        if (contentDiff.isReorderOrRemoval) {
          registryUpdatedMDXContent[target.locale] = sourceHashList;
        }

        result.frontmatter[target.locale] = frontmatterDiff.keysToTranslate;
        result.content[target.locale] = contentDiff.keysToTranslate;
      }
    }),
  );

  if (
    registryUpdatedFrontmatter ||
    Object.keys(registryUpdatedMDXContent).length > 0
  ) {
    const updatedRegistry: Registry = {
      content: {
        source: {
          ...registryData.content.source,
          hashes:
            Object.keys(registryUpdatedMDXContent).length > 0
              ? sourceHashList
              : registryData.content.source.hashes,
        },
        targets: {
          ...registryData.content.targets,
          ...registryUpdatedMDXContent,
        },
      },
      frontmatter: registryUpdatedFrontmatter || registryData.frontmatter,
    };
    pendingUpdates.push(() => registry.save(file.source.path, updatedRegistry));
  }

  return result;
}

/**
 * Updates the target MDX file when certain conditions are met:
 * 1. Content removal or reorder without new translation keys
 * 2. Frontmatter removals without translation keys
 * 3. Changes to excluded frontmatter keys.
 */
function rebuildTargetContent({
  contentDiff,
  frontmatterDiff,
  frontmatterExcludedKeys,
  registryData,
  sourceFrontmatter,
  sourceMDXContent,
  target,
  targetFrontmatter,
  targetMDXContent,
}: {
  contentDiff: DiffResult;
  frontmatterDiff: DiffResult;
  frontmatterExcludedKeys?: ReadonlyArray<string>;
  registryData: Registry;
  sourceFrontmatter: Record<string, string>;
  sourceMDXContent: string;
  target: TranslationFileItem;
  targetFrontmatter: Record<string, string>;
  targetMDXContent: string;
}) {
  const excludedFrontmatterKeysToUpdate = findFrontmatterExcludedKeysToUpdate(
    frontmatterExcludedKeys ?? [],
    sourceFrontmatter,
    targetFrontmatter,
  );

  const needsRebuild =
    frontmatterDiff.isReorderOrRemoval ||
    contentDiff.isReorderOrRemoval ||
    excludedFrontmatterKeysToUpdate.length > 0;

  if (!needsRebuild) {
    return;
  }

  // Rebuild content
  const updatedTargetMDXContent = contentDiff.isReorderOrRemoval
    ? buildTargetMDXContent(
        sourceMDXContent,
        targetMDXContent,
        registryData.content.targets[target.locale],
      )
    : targetMDXContent;

  // Rebuild frontmatter
  const updatedTargetFrontmatter =
    frontmatterDiff.isReorderOrRemoval ||
    excludedFrontmatterKeysToUpdate.length > 0
      ? buildTargetMDXFrontmatter(
          sourceFrontmatter,
          targetFrontmatter,
          {},
          frontmatterExcludedKeys,
        )
      : targetFrontmatter;

  const updatedTargetContent = grayMatter.stringify(
    updatedTargetMDXContent,
    updatedTargetFrontmatter,
  );

  return `${updatedTargetContent.trim()}\n`;
}

// Test exports
export const __test__ = {
  detectContentDiff,
  detectFrontmatterDiff,
  findFrontmatterExcludedKeysToUpdate,
  findMissingOrUpdatedContentKeys,
  findMissingOrUpdatedFrontmatterKeys,
  isSubset,
};
