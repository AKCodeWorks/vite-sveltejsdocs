import { promises as fs } from 'node:fs';
import path from 'node:path';
import { BLOCK_REGEX } from './constants.js';
import { cleanJSDocLine, createId, inferTitleFromSignature, normalize, signatureAfterBlock, slugify } from './helpers.js';
import type { AutoDocEntry, AutoDocTag } from './types.js';

/**
 * @auto-doc
 * @title Auto-Doc Block Parser
 * @group Parser Core
 * Parses a JSDoc block into a structured docs entry when it starts with `@auto-doc`.
 * Supports tags for `@param`, `@returns`, `@response`, `@example`, `@group`, `@title`, and `@description`.
 * @param block Raw content captured inside a matched JSDoc block.
 * @param fileContent Full source file text.
 * @param blockStart Start index of the matched block.
 * @param blockEnd End index of the matched block.
 * @param filePath Workspace-relative source file path.
 * @returns A parsed docs entry or null if the block is not eligible.
 */
export const parseBlock = (
  block: string,
  fileContent: string,
  blockStart: number,
  blockEnd: number,
  filePath: string
): AutoDocEntry | null => {
  const jsdocRaw = `/**${block}*/`;
  const lines = block.split('\n').map(cleanJSDocLine);

  const descriptionLines: string[] = [];
  const tags: AutoDocTag[] = [];
  const params: AutoDocTag[] = [];
  const examples: string[] = [];
  let returns = '';
  let response = '';
  let group = '';
  let customTitle = '';
  let customDisplayPath = '';
  let consumedAutoDoc = false;
  let currentExampleLines: string[] | null = null;
  let currentResponseLines: string[] | null = null;

  const flushCurrentExample = (): void => {
    if (!currentExampleLines) return;
    const value = currentExampleLines.join('\n').trim();
    if (value) examples.push(value);
    currentExampleLines = null;
  };

  const flushCurrentResponse = (): void => {
    if (!currentResponseLines) return;
    const value = currentResponseLines.join('\n').trim();
    if (value) response = value;
    currentResponseLines = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!consumedAutoDoc) {
      if (!trimmed) continue;
      if (trimmed !== '@auto-doc') return null;
      consumedAutoDoc = true;
      continue;
    }

    if (!trimmed) {
      if (currentExampleLines) {
        currentExampleLines.push('');
      } else if (currentResponseLines) {
        currentResponseLines.push('');
      } else {
        descriptionLines.push('');
      }
      continue;
    }

    if (trimmed.startsWith('@')) {
      flushCurrentExample();
      flushCurrentResponse();
      const [, name = '', rawValue = ''] = trimmed.match(/^@(\S+)\s*(.*)$/) ?? [];
      const value = rawValue.trim();
      if (!name) continue;
      const normalizedName = name.toLowerCase();

      if (normalizedName === 'param') {
        params.push({ name, value });
      } else if (normalizedName === 'returns' || normalizedName === 'return') {
        returns = value;
      } else if (normalizedName === 'response') {
        currentResponseLines = [];
        if (value) currentResponseLines.push(value);
      } else if (normalizedName === 'example') {
        currentExampleLines = [];
        if (value) currentExampleLines.push(value);
      } else if (normalizedName === 'group') {
        group = value;
      } else if (normalizedName === 'title' || normalizedName === 'doc-title') {
        customTitle = value;
      } else if (normalizedName === 'description' || normalizedName === 'doc-description') {
        customDisplayPath = value;
      } else {
        tags.push({ name, value });
      }
      continue;
    }

    if (currentExampleLines) {
      currentExampleLines.push(trimmed);
      continue;
    }

    if (currentResponseLines) {
      currentResponseLines.push(trimmed);
      continue;
    }

    descriptionLines.push(trimmed);
  }

  flushCurrentExample();
  flushCurrentResponse();

  if (!consumedAutoDoc) return null;

  const description = descriptionLines.join('\n').trim();
  const summary = description.split('\n').find((line) => line.trim().length > 0) ?? 'No summary provided.';
  const line = fileContent.slice(0, blockStart).split('\n').length;
  const signature = signatureAfterBlock(fileContent, blockEnd);
  const fallbackTitle = path.basename(filePath).replace(path.extname(filePath), '');
  const inferredTitle = inferTitleFromSignature(signature, fallbackTitle);
  const title = customTitle || inferredTitle;
  const displayPath = customDisplayPath || `${filePath}:${line}`;

  const id = createId(filePath, line);
  return {
    id,
    slug: slugify(`${title}-${line}`),
    group,
    title,
    summary,
    description,
    jsdocRaw,
    signature,
    filePath,
    line,
    displayPath,
    params,
    returns,
    response,
    examples,
    tags
  };
};

/**
 * @auto-doc
 * @title File Docs Extractor
 * @group Parser Core
 * Extracts all eligible auto-doc blocks from a source file.
 * @param absolutePath Absolute file path being parsed.
 * @param root Workspace root used to produce relative paths in output.
 * @returns Parsed docs entries found in the file.
 */
export const parseFileDocs = async (absolutePath: string, root: string): Promise<AutoDocEntry[]> => {
  const content = await fs.readFile(absolutePath, 'utf8');
  const relPath = normalize(path.relative(root, absolutePath));
  const docs: AutoDocEntry[] = [];

  for (const match of content.matchAll(BLOCK_REGEX)) {
    const block = match[1];
    if (!block || match.index == null) continue;
    const blockStart = match.index;
    const blockEnd = blockStart + match[0].length;
    const parsed = parseBlock(block, content, blockStart, blockEnd, relPath);
    if (parsed) docs.push(parsed);
  }

  return docs;
};
