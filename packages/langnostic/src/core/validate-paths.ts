import fs from 'node:fs/promises';
import path from 'node:path';

import type { TranslationFileMetadata } from './types';

async function canonicalPath(filePath: string): Promise<string> {
  let current = path.resolve(filePath);
  const missing: Array<string> = [];
  for (;;) {
    try {
      return path.join(await fs.realpath(current), ...missing);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      missing.unshift(path.basename(current));
      current = path.dirname(current);
    }
  }
}

export async function validateFilePaths(
  files: ReadonlyArray<TranslationFileMetadata>,
) {
  const resolved = await Promise.all(
    files.map(async (file) => ({
      source: await canonicalPath(file.source.path),
      targets: await Promise.all(
        file.targets.map(async (target) => ({
          path: await canonicalPath(target.path),
          originalPath: target.path,
        })),
      ),
    })),
  );
  const sources = new Set(resolved.map((file) => file.source));
  const targets = new Set<string>();
  for (const file of resolved) {
    for (const target of file.targets) {
      if (sources.has(target.path)) {
        throw new Error(
          `Target path would overwrite a source file: ${target.originalPath}`,
        );
      }
      if (targets.has(target.path)) {
        throw new Error(
          `Target path is configured more than once: ${target.originalPath}`,
        );
      }
      targets.add(target.path);
    }
  }
}
