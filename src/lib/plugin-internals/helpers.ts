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
 * Finds the next likely declaration/signature line after a matched JSDoc block.
 * @param fileContent Full file content containing the matched block.
 * @param blockEnd End index of the matched JSDoc block.
 * @returns The first non-empty, non-comment line after the block.
 */
export const signatureAfterBlock = (fileContent: string, blockEnd: number): string => {
  const trailing = fileContent.slice(blockEnd);
  const lines = trailing
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('//'));

  const isLikelySignatureLine = (line: string): boolean => {
    if (line.startsWith('/*') || line.startsWith('*')) return false;
    if (/^(import|from)\b/.test(line)) return false;

    if (/^(export\s+)?(async\s+)?(function|class|interface|type|enum)\b/.test(line)) return true;
    if (/^(export\s+)?(const|let|var)\s+[A-Za-z_$][\w$]*\s*=/.test(line)) return true;
    if (/^(public|private|protected|static|readonly|async|get|set)\s+/.test(line)) return true;
    if (/^[A-Za-z_$][\w$]*\s*\([^)]*\)\s*(?::[^{}=]+)?\s*(\{|=>)/.test(line)) return true;

    return false;
  };

  return lines.find(isLikelySignatureLine) ?? '';
};
