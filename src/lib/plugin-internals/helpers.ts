/**
 * @auto-doc
 * @title Path Normalizer
 * @group Plugin Internals
 * Normalizes file separators for stable cross-platform path keys.
 * @param value Input path value that may include platform-specific separators.
 * @returns A slash-normalized path string.
 */
export const normalize = (value: string): string => value.replaceAll('\\', '/');

/**
 * @auto-doc
 * @title Slug Generator
 * @group Plugin Internals
 * Creates a URL-safe slug from human-readable text.
 * @param value Source text used to build the slug.
 * @returns A normalized, lowercase slug identifier.
 */
export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'doc';

/**
 * @auto-doc
 * @title JSDoc Line Cleaner
 * @group Parser Helpers
 * Removes leading JSDoc formatting tokens from a single comment line.
 * @param line Raw line captured from a JSDoc comment block.
 * @returns A cleaned line ready for parsing.
 */
export const cleanJSDocLine = (line: string): string => line.replace(/^\s*\* ?/, '').trimEnd();

/**
 * @auto-doc
 * @title Entry Identifier Builder
 * @group Parser Helpers
 * Generates a deterministic identifier from relative file path and line number.
 * @param filePath Workspace-relative path for the source file.
 * @param line 1-based source line where the JSDoc block starts.
 * @returns A stable entry id in `path:line` format.
 */
export const createId = (filePath: string, line: number): string => `${filePath}:${line}`;

/**
 * @auto-doc
 * @title Signature Title Inference
 * @group Parser Helpers
 * Infers an entry title from the signature line when no explicit override is provided.
 * @param signature First non-empty line after a matched JSDoc block.
 * @param fallback Fallback name used when no symbol can be inferred.
 * @returns The inferred symbol name or the fallback value.
 */
export const inferTitleFromSignature = (signature: string, fallback: string): string => {
  if (!signature) return fallback;
  const fnMatch = signature.match(/(?:function\s+)?([A-Za-z_$][\w$]*)\s*\(/);
  if (fnMatch?.[1]) return fnMatch[1];
  const classMatch = signature.match(/class\s+([A-Za-z_$][\w$]*)/);
  if (classMatch?.[1]) return classMatch[1];
  const constFnMatch = signature.match(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/);
  if (constFnMatch?.[1]) return constFnMatch[1];
  return fallback;
};

/**
 * @auto-doc
 * @title Signature Locator
 * @group Parser Helpers
 * Finds the next likely declaration block after a matched JSDoc block.
 * @param fileContent Full file content containing the matched block.
 * @param blockEnd End index of the matched JSDoc block.
 * @returns The next declaration block, trimmed and de-indented for display.
 */
export const signatureAfterBlock = (fileContent: string, blockEnd: number): string => {
  const trailing = fileContent.slice(blockEnd);
  const lines = trailing.split('\n').map((line) => line.replace(/\r$/, ''));

  const isLikelySignatureLine = (line: string): boolean => {
    if (line.startsWith('/*') || line.startsWith('*')) return false;
    if (/^(import|from)\b/.test(line)) return false;

    if (/^(export\s+)?(async\s+)?(function|class|interface|type|enum)\b/.test(line)) return true;
    if (/^(export\s+)?(const|let|var)\s+[A-Za-z_$][\w$]*\s*=/.test(line)) return true;
    if (/^(public|private|protected|static|readonly|async|get|set)\s+/.test(line)) return true;
    if (/^[A-Za-z_$][\w$]*\s*\([^)]*\)\s*(?::[^{}=]+)?\s*(\{|=>)/.test(line)) return true;

    return false;
  };

  const startIndex = lines.findIndex((line) => {
    const trimmed = line.trim();
    return trimmed.length > 0 && !trimmed.startsWith('//') && isLikelySignatureLine(trimmed);
  });

  if (startIndex < 0) return '';

  const trimAndDedent = (blockLines: string[]): string => {
    const withoutEdgeBlanks = [...blockLines];
    while (withoutEdgeBlanks[0]?.trim() === '') withoutEdgeBlanks.shift();
    while (withoutEdgeBlanks[withoutEdgeBlanks.length - 1]?.trim() === '') withoutEdgeBlanks.pop();
    if (withoutEdgeBlanks.length === 0) return '';

    const indents = withoutEdgeBlanks
      .filter((line) => line.trim().length > 0)
      .map((line) => line.match(/^\s*/)?.[0].length ?? 0);
    const minIndent = indents.length > 0 ? Math.min(...indents) : 0;

    return withoutEdgeBlanks.map((line) => line.slice(minIndent).trimEnd()).join('\n').trim();
  };

  const collected: string[] = [];
  let braceDepth = 0;
  let bracketDepth = 0;
  let parenDepth = 0;
  let sawBlock = false;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTemplateString = false;
  let inBlockComment = false;
  let escaped = false;

  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (collected.length > 0 && trimmed.startsWith('/**')) break;

    collected.push(line);

    for (let cursor = 0; cursor < line.length; cursor += 1) {
      const ch = line[cursor];
      const next = line[cursor + 1] ?? '';

      if (inBlockComment) {
        if (ch === '*' && next === '/') {
          inBlockComment = false;
          cursor += 1;
        }
        continue;
      }

      if (escaped) {
        escaped = false;
        continue;
      }

      if (inSingleQuote) {
        if (ch === '\\') {
          escaped = true;
          continue;
        }
        if (ch === "'") inSingleQuote = false;
        continue;
      }

      if (inDoubleQuote) {
        if (ch === '\\') {
          escaped = true;
          continue;
        }
        if (ch === '"') inDoubleQuote = false;
        continue;
      }

      if (inTemplateString) {
        if (ch === '\\') {
          escaped = true;
          continue;
        }
        if (ch === '`') {
          inTemplateString = false;
          continue;
        }
      }

      if (ch === '/' && next === '/') break;
      if (ch === '/' && next === '*') {
        inBlockComment = true;
        cursor += 1;
        continue;
      }
      if (ch === "'") {
        inSingleQuote = true;
        continue;
      }
      if (ch === '"') {
        inDoubleQuote = true;
        continue;
      }
      if (ch === '`') {
        inTemplateString = true;
        continue;
      }

      if (ch === '{') {
        braceDepth += 1;
        sawBlock = true;
        continue;
      }
      if (ch === '}') {
        braceDepth = Math.max(0, braceDepth - 1);
        continue;
      }
      if (ch === '[') {
        bracketDepth += 1;
        continue;
      }
      if (ch === ']') {
        bracketDepth = Math.max(0, bracketDepth - 1);
        continue;
      }
      if (ch === '(') {
        parenDepth += 1;
        continue;
      }
      if (ch === ')') {
        parenDepth = Math.max(0, parenDepth - 1);
      }
    }

    const balanced = braceDepth === 0 && bracketDepth === 0 && parenDepth === 0 && !inBlockComment;
    if (!balanced) continue;

    if (sawBlock) {
      return trimAndDedent(collected);
    }

    if (/[;}]\s*$/.test(trimmed)) {
      return trimAndDedent(collected);
    }
  }

  return trimAndDedent(collected);
};
