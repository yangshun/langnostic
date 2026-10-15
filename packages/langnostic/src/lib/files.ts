import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { canonicalPath } from '@/core/validate-paths';

/** Replace a file only after its complete contents have been written beside it. */
export async function writeFileAtomic(
  filePath: string,
  content: string,
): Promise<void> {
  const destination = await canonicalPath(filePath);
  const directory = path.dirname(destination);
  await fs.mkdir(directory, { recursive: true });
  let mode: number | undefined;
  try {
    mode = (await fs.stat(destination)).mode;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
  const temporaryPath = path.join(
    directory,
    `.${path.basename(destination)}.${randomUUID()}.tmp`,
  );
  try {
    await fs.writeFile(temporaryPath, content, {
      encoding: 'utf8',
      flag: 'wx',
      mode,
    });
    await fs.rename(temporaryPath, destination);
  } finally {
    await fs.rm(temporaryPath, { force: true });
  }
}

export async function writeJsonAtomic(
  filePath: string,
  value: unknown,
): Promise<void> {
  await writeFileAtomic(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
