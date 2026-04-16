import { promises as fs } from 'node:fs';
import path from 'node:path';
import { EXCLUDED_DIRS } from './constants.js';

/**
 * @auto-doc
 * @title Source File Walker
 * @group File Discovery
 * Recursively walks the scan directory and collects source files matching configured extensions.
 * Skips ignored system/build directories and the generated output file itself.
 * @param dir Current directory being traversed.
 * @param extensions Allowed file extensions.
 * @param outputFilePath Absolute path of the generated docs output file.
 * @returns A flat list of absolute source file paths.
 */
export const walk = async (
  dir: string,
  extensions: Set<string>,
  outputFilePath: string
): Promise<string[]> => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (fullPath === outputFilePath) return [];

      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry.name)) return [];
        return walk(fullPath, extensions, outputFilePath);
      }

      if (!entry.isFile()) return [];
      if (!extensions.has(path.extname(entry.name))) return [];
      return [fullPath];
    })
  );

  return files.flat();
};
