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
 * Supports tags for `@param`, `@returns`, `@response`, `@headers`, `@body`, `@fetchUrl`, `@example`, `@group`, `@title`, and `@description`.
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
  let headers = '';
  let body = '';
  let fetchUrl = '';
  let group = '';
  let customTitle = '';
  let customDescription = '';
  let customDisplayPath = '';
  let consumedAutoDoc = false;
  let activeValue:
    | {
        kind: 'example' | 'response' | 'returns' | 'headers' | 'body' | 'fetchUrl' | 'param' | 'tag' | 'description';
        name?: string;
        lines: string[];
      }
    | null = null;

  const flushActiveValue = (): void => {
    if (!activeValue) return;
    const value = activeValue.lines.join('\n').trim();

    if (value) {
      if (activeValue.kind === 'example') {
        examples.push(value);
      } else if (activeValue.kind === 'response') {
        response = value;
      } else if (activeValue.kind === 'returns') {
        returns = value;
      } else if (activeValue.kind === 'headers') {
        headers = value;
      } else if (activeValue.kind === 'body') {
        body = value;
      } else if (activeValue.kind === 'fetchUrl') {
        fetchUrl = value;
      } else if (activeValue.kind === 'description') {
        customDescription = value;
      } else if (activeValue.kind === 'param') {
        params.push({ name: activeValue.name ?? 'param', value });
      } else if (activeValue.kind === 'tag') {
        tags.push({ name: activeValue.name ?? 'tag', value });
      }
    }

    activeValue = null;
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
      if (activeValue) {
        activeValue.lines.push('');
      } else {
        descriptionLines.push('');
      }
      continue;
    }

    if (trimmed.startsWith('@')) {
      flushActiveValue();
      const [, name = '', rawValue = ''] = trimmed.match(/^@(\S+)\s*(.*)$/) ?? [];
      const value = rawValue.trim();
      if (!name) continue;
      const normalizedName = name.toLowerCase();

      if (normalizedName === 'param') {
        activeValue = { kind: 'param', name, lines: value ? [value] : [] };
      } else if (normalizedName === 'returns' || normalizedName === 'return') {
        activeValue = { kind: 'returns', lines: value ? [value] : [] };
      } else if (normalizedName === 'response') {
        activeValue = { kind: 'response', lines: value ? [value] : [] };
      } else if (normalizedName === 'headers') {
        activeValue = { kind: 'headers', lines: value ? [value] : [] };
      } else if (normalizedName === 'body') {
        activeValue = { kind: 'body', lines: value ? [value] : [] };
      } else if (normalizedName === 'fetchurl' || normalizedName === 'fetch-url') {
        activeValue = { kind: 'fetchUrl', lines: value ? [value] : [] };
      } else if (normalizedName === 'example') {
        activeValue = { kind: 'example', lines: value ? [value] : [] };
      } else if (normalizedName === 'group') {
        group = value;
      } else if (normalizedName === 'title' || normalizedName === 'doc-title') {
        customTitle = value;
      } else if (normalizedName === 'description' || normalizedName === 'doc-description') {
        activeValue = { kind: 'description', lines: value ? [value] : [] };
      } else if (
        normalizedName === 'displaypath' ||
        normalizedName === 'display-path' ||
        normalizedName === 'doc-displaypath' ||
        normalizedName === 'doc-display-path'
      ) {
        customDisplayPath = value;
      } else {
        activeValue = { kind: 'tag', name, lines: value ? [value] : [] };
      }
      continue;
    }

    if (activeValue) {
      activeValue.lines.push(trimmed);
      continue;
    }

    descriptionLines.push(trimmed);
  }

  flushActiveValue();

  if (!consumedAutoDoc) return null;

  const description = customDescription || descriptionLines.join('\n').trim();
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
    slug: slugify(title),
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
    headers,
    body,
    fetchUrl,
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
