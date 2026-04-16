export const DEFAULT_EXTENSIONS = ['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.svelte'];
export const BLOCK_REGEX = /\/\*\*([\s\S]*?)\*\//g;
export const EXCLUDED_DIRS = new Set(['node_modules', '.git', '.svelte-kit', 'dist', 'build']);
