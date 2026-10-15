import fs from 'node:fs/promises';

import grayMatter from 'gray-matter';
import type {
  LangnosticPlugin,
  TranslationFileMetadata,
  TranslationStringArg,
} from 'langnostic';
import {
  buildTranslatedContentMap,
  buildTranslationStrings,
  writeFileAtomic,
} from 'langnostic';
import { mapValues } from 'lodash-es';

import { processFileForChanges } from './mdx-change-detector';
import { buildTargetMDX, generateSourceMDXContentHashMap } from './mdx-file';
import registryManager from './registry-manager';

export type PluginOptions = Readonly<{
  frontmatterExcludedKeys?: Array<string>;
}>;

export default function mdxPlugin(options?: PluginOptions): LangnosticPlugin {
  const files: Array<TranslationFileMetadata> = [];
  const registry = registryManager();
  const pendingUpdates: Array<() => Promise<void>> = [];

  return {
    async getInstructions() {
      return [
        'These strings are part of an MDX file, which can contain both markdown and JSX.',
        'Make sure to return all the translated objects for all the strings.',
        'Keep all inline code (especially anything wrapped in single backticks like `<noscript>`, `<Component /> etc.`) exactly as-is, without removing or replacing the tags inside.',
        'For languages that do not use spaces between words (e.g., Chinese, Japanese, Thai, etc.), STRICTLY REMOVE any space directly before or after JSX tags and curly braces in the string—even if the tag appears at the beginning or end of the string.',
        '✅ Example:',
        '  - English: "## <CompanyName /> Front End Interview Preparation Guide"',
        '  - Correct: "## <CompanyName />前端面试准备指南"',
        '  - ❌ Incorrect: "## <CompanyName /> 前端面试准备指南"',
        'Make sure to return translations for all provided strings.',
      ].join('\n');
    },
    async getTranslationStrings() {
      pendingUpdates.length = 0;
      const translationStrings: Array<TranslationStringArg> = [];

      for (const file of files) {
        // Process file for changes
        const changes = await processFileForChanges(
          file,
          options,
          pendingUpdates,
        );

        const sourceContent = await fs.readFile(file.source.path, 'utf8');
        const { content, data: sourceFrontmatter } = grayMatter(sourceContent);
        const sourceHashMap = generateSourceMDXContentHashMap(content);

        const frontmatterTranslationStrings = buildTranslationStrings(
          mapValues(sourceFrontmatter, (string) => ({ string })),
          changes.frontmatter,
          file,
        );

        const mdxContentTranslationStrings = buildTranslationStrings(
          mapValues(sourceHashMap, (string) => ({ string })),
          changes.content,
          file,
        );

        translationStrings.push(...frontmatterTranslationStrings);
        translationStrings.push(...mdxContentTranslationStrings);
      }

      return translationStrings;
    },
    async onTranslationStart() {
      for (const update of pendingUpdates.splice(0)) {
        await update();
      }
    },
    async onTranslationBatchComplete(translatedStrings) {
      if (translatedStrings.length === 0) {
        return;
      }

      const file = files.find(
        (f) => f.source.path === translatedStrings[0].batchId,
      );

      if (file == null) {
        return;
      }

      const translatedContentMap = buildTranslatedContentMap(translatedStrings);
      const sourceContent = await fs.readFile(file.source.path, 'utf8');
      const registryData = await registry.load(file.source.path);

      // Write to each target file concurrently
      const writes = await Promise.allSettled(
        file.targets.map(async (target) => {
          const targetContent = await fs
            .readFile(target.path, 'utf8')
            .catch((error: NodeJS.ErrnoException) => {
              if (error.code !== 'ENOENT') {
                throw error;
              }
              return '';
            });
          const translatedContent =
            translatedContentMap.get(target.locale) || {};

          const targetHashList =
            registryData?.content?.targets?.[target.locale] || [];

          // Build target MDX file content
          const targetFileContent = buildTargetMDX(
            sourceContent,
            targetContent,
            targetHashList,
            translatedContent,
          );

          await writeFileAtomic(target.path, targetFileContent);
        }),
      );
      for (const write of writes) {
        if (write.status === 'rejected') {
          throw write.reason;
        }
      }

      await registry.updateFileRegistry(file, options);
    },
    stringsPerRequest: 20,
    async trackFiles(filesMetadata) {
      // Start tracking files
      files.push(...filesMetadata);
    },
    type: 'mdx',
  };
}
