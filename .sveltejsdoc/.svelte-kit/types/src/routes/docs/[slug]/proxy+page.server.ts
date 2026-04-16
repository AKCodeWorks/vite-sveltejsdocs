// @ts-nocheck
import path from 'node:path';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { createHighlighter } from 'shiki';
import { authors, docs, type GeneratedAuthorProfile } from '../generated';

type HighlightLanguage =
	| 'javascript'
	| 'typescript'
	| 'json'
	| 'jsx'
	| 'tsx'
	| 'svelte'
	| 'python'
	| 'ruby'
	| 'php'
	| 'java'
	| 'go'
	| 'rust'
	| 'c'
	| 'cpp'
	| 'csharp'
	| 'html'
	| 'css'
	| 'scss'
	| 'markdown'
	| 'yaml'
	| 'bash';

type HighlightedExample = {
	key: string;
	label: string | null;
	html: string;
};

const collapseJson = false;
const highlighterCache = globalThis as typeof globalThis & {
	__sveltejsdocHighlighterPromise__?: ReturnType<typeof createHighlighter>;
};
const highlightLangs: HighlightLanguage[] = [
	'javascript',
	'typescript',
	'json',
	'jsx',
	'tsx',
	'svelte',
	'python',
	'ruby',
	'php',
	'java',
	'go',
	'rust',
	'c',
	'cpp',
	'csharp',
	'html',
	'css',
	'scss',
	'markdown',
	'yaml',
	'bash'
];

const getHighlighter = () => {
	if (!highlighterCache.__sveltejsdocHighlighterPromise__) {
		highlighterCache.__sveltejsdocHighlighterPromise__ = createHighlighter({
			themes: ['github-light'],
			langs: highlightLangs
		});
	}

	return highlighterCache.__sveltejsdocHighlighterPromise__;
};

const normalizeAuthorKey = (value: string): string => value.trim().replace(/^@/, '').toLowerCase();

const inferExampleLanguage = (label: string | null, content: string): HighlightLanguage => {
	const normalizedLabel = label?.trim().toLowerCase() ?? '';
	const trimmed = content.trim();

	if (
		normalizedLabel.includes('curl') ||
		normalizedLabel.includes('shell') ||
		normalizedLabel.includes('bash') ||
		trimmed.startsWith('curl ') ||
		trimmed.startsWith('HTTP/')
	) {
		return 'bash';
	}

	if (isJsonBlock(trimmed)) {
		return 'json';
	}

	return 'javascript';
};

const splitExampleContent = (example: string, index: number): { key: string; label: string | null; content: string; language: HighlightLanguage } => {
	const trimmed = example.trim();
	const lines = trimmed.split('\n');
	const firstLine = lines[0]?.trim() ?? '';
	const remainder = lines.slice(1).join('\n').trim();
	const canUseFirstLineAsLabel =
		Boolean(remainder) &&
		/^[A-Za-z][A-Za-z0-9 /_+-]{0,40}:?$/.test(firstLine) &&
		!/[{}()[]=;]/.test(firstLine);
	const label = canUseFirstLineAsLabel ? firstLine.replace(/:$/, '') : null;
	const content = canUseFirstLineAsLabel ? remainder : trimmed;

	return {
		key: 'example-' + index,
		label,
		content,
		language: inferExampleLanguage(label, content)
	};
};

const candidateKeysFromTag = (raw: string): string[] => {
	const cleaned = raw.trim();
	if (!cleaned) return [];

	const parts = cleaned
		.split(/[\s,|]+/)
		.map((part) => normalizeAuthorKey(part))
		.filter(Boolean);

	const full = normalizeAuthorKey(cleaned);
	return [...new Set([full, ...parts])];
};

const resolveAuthor = (tagValue: string): { key: string; profile: GeneratedAuthorProfile } | null => {
	for (const key of candidateKeysFromTag(tagValue)) {
		const profile = authors[key];
		if (profile) return { key, profile };
	}

	return null;
};

const isJsonBlock = (value: string): boolean => {
	const trimmed = value.trim();
	if (!trimmed) return false;
	if (!((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']')))) {
		return false;
	}

	try {
		JSON.parse(trimmed);
		return true;
	} catch {
		return false;
	}
};

const isTypeObject = (value: string): boolean => {
	const trimmed = value.trim();
	return trimmed.startsWith('{') && trimmed.endsWith('}');
};

const extractJsonBlock = (value: string): { value: string; remainder: string } | null => {
	const trimmed = value.trim();
	if (!trimmed) return null;

	if (isJsonBlock(trimmed)) {
		return {
			value: trimmed,
			remainder: ''
		};
	}

	const lines = value.split('\n');

	for (let start = 0; start < lines.length; start += 1) {
		const startTrimmed = lines[start].trim();
		if (!(startTrimmed.startsWith('{') || startTrimmed.startsWith('['))) continue;

		for (let end = start; end < lines.length; end += 1) {
			const candidate = lines.slice(start, end + 1).join('\n').trim();
			if (!isJsonBlock(candidate)) continue;

			const before = lines.slice(0, start).join('\n').trimEnd();
			const after = lines.slice(end + 1).join('\n').trimStart();
			return {
				value: candidate,
				remainder: [before, after].filter(Boolean).join('\n\n').trim()
			};
		}
	}

	return null;
};

const formatTypeObject = (value: string): string => {
	const source = value.trim();
	if (!source) return '';

	const indentUnit = '  ';
	let out = '';
	let depth = 0;
	let inSingleQuote = false;
	let inDoubleQuote = false;
	let escaped = false;

	const isWhitespace = (ch: string): boolean => ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t';
	const appendIndent = (count: number): void => {
		if (count <= 0) return;
		out += indentUnit.repeat(count);
	};
	const nextNonWhitespace = (start: number): string => {
		for (let i = start; i < source.length; i += 1) {
			const ch = source[i];
			if (!isWhitespace(ch)) return ch;
		}
		return '';
	};

	for (let i = 0; i < source.length; i += 1) {
		const ch = source[i];

		if (inSingleQuote || inDoubleQuote) {
			out += ch;
			if (escaped) {
				escaped = false;
				continue;
			}
			if (ch === '\\') {
				escaped = true;
				continue;
			}
			if (inSingleQuote && ch === "'") {
				inSingleQuote = false;
			} else if (inDoubleQuote && ch === '"') {
				inDoubleQuote = false;
			}
			continue;
		}

		if (ch === "'") {
			inSingleQuote = true;
			out += ch;
			continue;
		}

		if (ch === '"') {
			inDoubleQuote = true;
			out += ch;
			continue;
		}

		if (collapseJson) {
			if (isWhitespace(ch)) {
				if (out.length > 0 && out[out.length - 1] !== ' ') out += ' ';
				continue;
			}
			out += ch;
			continue;
		}

		if (isWhitespace(ch)) {
			if (out.endsWith('\n')) continue;
			if (!out.endsWith(' ')) out += ' ';
			continue;
		}

		if (ch === '{' || ch === '[') {
			out += ch;
			depth += 1;
			const closing = ch === '{' ? '}' : ']';
			if (nextNonWhitespace(i + 1) !== closing) {
				out += '\n';
				appendIndent(depth);
			}
			continue;
		}

		if (ch === '}' || ch === ']') {
			depth = Math.max(0, depth - 1);
			while (out.endsWith(' ')) out = out.slice(0, -1);
			if (!out.endsWith('\n') && out.length > 0) {
				out += '\n';
			}
			appendIndent(depth);
			out += ch;
			continue;
		}

		if (ch === ',') {
			out += ',\n';
			appendIndent(depth);
			continue;
		}

		if (ch === ':') {
			while (out.endsWith(' ')) out = out.slice(0, -1);
			out += ': ';
			continue;
		}

		if (ch === '|') {
			while (out.endsWith(' ')) out = out.slice(0, -1);
			out += ' | ';
			continue;
		}

		out += ch;
	}

	return out.trim();
};

const detectLanguage = (value: string, fallback: HighlightLanguage = 'javascript'): HighlightLanguage => {
	if (isJsonBlock(value)) return 'json';
	if (isTypeObject(value)) return 'typescript';
	return fallback;
};

const languageFromFilePath = (filePath: string): HighlightLanguage => {
	switch (path.extname(filePath).toLowerCase()) {
		case '.ts':
		case '.mts':
		case '.cts':
			return 'typescript';
		case '.tsx':
			return 'tsx';
		case '.js':
		case '.mjs':
		case '.cjs':
			return 'javascript';
		case '.jsx':
			return 'jsx';
		case '.svelte':
			return 'svelte';
		case '.py':
			return 'python';
		case '.rb':
			return 'ruby';
		case '.php':
			return 'php';
		case '.java':
			return 'java';
		case '.go':
			return 'go';
		case '.rs':
			return 'rust';
		case '.c':
			return 'c';
		case '.cc':
		case '.cpp':
		case '.cxx':
		case '.hpp':
		case '.hh':
		case '.hxx':
		case '.h':
			return 'cpp';
		case '.cs':
			return 'csharp';
		case '.html':
		case '.htm':
			return 'html';
		case '.css':
			return 'css';
		case '.scss':
			return 'scss';
		case '.md':
		case '.mdx':
			return 'markdown';
		case '.yaml':
		case '.yml':
			return 'yaml';
		case '.sh':
		case '.bash':
		case '.zsh':
			return 'bash';
		case '.json':
			return 'json';
		default:
			return 'typescript';
	}
};

const normalizeCodeForHighlight = (value: string, language: HighlightLanguage): string => {
	if (language === 'json' && isJsonBlock(value)) {
		const parsed = JSON.parse(value);
		return collapseJson ? JSON.stringify(parsed) : JSON.stringify(parsed, null, 2);
	}

	if (language === 'typescript' && isTypeObject(value)) {
		return formatTypeObject(value);
	}

	return value;
};

const highlightCode = async (value: string, fallback: HighlightLanguage = 'javascript'): Promise<string> => {
	const language = detectLanguage(value, fallback);
	const highlighter = await getHighlighter();
	return highlighter.codeToHtml(normalizeCodeForHighlight(value, language), {
		lang: language,
		theme: 'github-light'
	});
};

const toJsonLiteral = (value: string): string | null => {
	if (!isJsonBlock(value)) return null;
	return JSON.stringify(JSON.parse(value), null, 2);
};

const splitTopLevelMembers = (value: string): string[] => {
	const members: string[] = [];
	let current = '';
	let depth = 0;
	let inSingleQuote = false;
	let inDoubleQuote = false;
	let escaped = false;

	for (let index = 0; index < value.length; index += 1) {
		const ch = value[index];

		if (escaped) {
			current += ch;
			escaped = false;
			continue;
		}

		if (ch === '\\') {
			current += ch;
			escaped = true;
			continue;
		}

		if (inSingleQuote) {
			current += ch;
			if (ch === "'") inSingleQuote = false;
			continue;
		}

		if (inDoubleQuote) {
			current += ch;
			if (ch === '"') inDoubleQuote = false;
			continue;
		}

		if (ch === "'") {
			inSingleQuote = true;
			current += ch;
			continue;
		}

		if (ch === '"') {
			inDoubleQuote = true;
			current += ch;
			continue;
		}

		if (ch === '{' || ch === '[' || ch === '(') {
			depth += 1;
			current += ch;
			continue;
		}

		if (ch === '}' || ch === ']' || ch === ')') {
			depth = Math.max(0, depth - 1);
			current += ch;
			continue;
		}

		if (ch === ',' && depth === 0) {
			if (current.trim()) members.push(current.trim());
			current = '';
			continue;
		}

		current += ch;
	}

	if (current.trim()) members.push(current.trim());
	return members;
};

const findTopLevelColon = (value: string): number => {
	let depth = 0;
	let inSingleQuote = false;
	let inDoubleQuote = false;
	let escaped = false;

	for (let index = 0; index < value.length; index += 1) {
		const ch = value[index];

		if (escaped) {
			escaped = false;
			continue;
		}

		if (ch === '\\') {
			escaped = true;
			continue;
		}

		if (inSingleQuote) {
			if (ch === "'") inSingleQuote = false;
			continue;
		}

		if (inDoubleQuote) {
			if (ch === '"') inDoubleQuote = false;
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

		if (ch === '{' || ch === '[' || ch === '(') {
			depth += 1;
			continue;
		}

		if (ch === '}' || ch === ']' || ch === ')') {
			depth = Math.max(0, depth - 1);
			continue;
		}

		if (ch === ':' && depth === 0) {
			return index;
		}
	}

	return -1;
};

const isQuotedLiteral = (value: string): boolean => {
	return (
		(value.startsWith('"') && value.endsWith('"')) ||
		(value.startsWith("'") && value.endsWith("'")) ||
		(value.startsWith('`') && value.endsWith('`'))
	);
};

const toFetchScalarLiteral = (value: string): string => {
	const trimmed = value.trim();
	if (!trimmed) return "''";
	if (isQuotedLiteral(trimmed)) return trimmed;
	if (/^-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?$/.test(trimmed)) return trimmed;
	if (/^(true|false|null|undefined)$/u.test(trimmed)) return trimmed;
	return JSON.stringify(trimmed);
};

const toFetchObjectLiteral = (value: string): string | null => {
	if (!isTypeObject(value)) return null;

	const inner = value.trim().slice(1, -1).trim();
	if (!inner) return '{}';

	const members = splitTopLevelMembers(inner)
		.map((member) => {
			const colonIndex = findTopLevelColon(member);
			if (colonIndex < 0) return null;

			const rawKey = member.slice(0, colonIndex).trim().replace(/\?$/u, '');
			const rawValue = member.slice(colonIndex + 1).trim();
			if (!rawKey || !rawValue) return null;

			const key = /^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(rawKey) ? rawKey : JSON.stringify(rawKey);
			const valueLiteral = toFetchValueLiteral(rawValue);
			return key + ': ' + valueLiteral;
		})
		.filter((member): member is string => Boolean(member));

	if (members.length === 0) return '{}';
	return '{\n  ' + members.join(',\n  ') + '\n}';
};

const toFetchValueLiteral = (value: string): string => {
	const jsonLiteral = toJsonLiteral(value);
	if (jsonLiteral) return jsonLiteral;

	const objectLiteral = toFetchObjectLiteral(value);
	if (objectLiteral) return objectLiteral;

	return toFetchScalarLiteral(value);
};

const toFetchHeadersLiteral = (value: string): string => {
	return toFetchValueLiteral(value);
};

const toFetchBodyLiteral = (value: string): string => {
	const jsonLiteral = toJsonLiteral(value);
	if (jsonLiteral) return 'JSON.stringify(' + jsonLiteral + ', null, 2)';

	const objectLiteral = toFetchObjectLiteral(value);
	if (objectLiteral) return 'JSON.stringify(' + objectLiteral + ', null, 2)';

	return JSON.stringify(value);
};

const escapeRegExp = (value: string): string => value.replace(/[\^$.*+?()[]{}|]/g, '\$&');

const extractParamName = (value: string): string | null => {
	const trimmed = value.trim();
	if (!trimmed) return null;
	const match = trimmed.match(/^(S+)/u);
	const rawName = match?.[1]?.trim() ?? '';
	return rawName ? rawName.replace(/[?:]+$/u, '') : null;
};

const routePathFromTag = (value: string): string => {
	const trimmed = value.trim();
	if (!trimmed) return '';
	const match = trimmed.match(/^(?:[A-Z]+s+)?(.+)$/u);
	return match?.[1]?.trim() ?? trimmed;
};

const buildFetchUrl = (doc: (typeof docs)[number]): string => {
	const paramNames = doc.params
		.map((param) => extractParamName(param.value))
		.filter((name): name is string => Boolean(name));
	const routeTag = doc.tags.find((tag) => tag.name.toLowerCase() === 'route');
	const configuredUrl = doc.fetchUrl.trim() || routePathFromTag(routeTag?.value ?? '') || 'https://api.example.com/endpoint';
	let url = configuredUrl;
	let usedTemplate = false;

	for (const paramName of paramNames) {
		const placeholderValue = '<' + paramName + '>';
		const escapedName = escapeRegExp(paramName);
		const curlyPattern = new RegExp('\\{' + escapedName + '\\}', 'g');
		const colonPattern = new RegExp(':' + escapedName + '(?=\\b|/|$)', 'g');
		if (curlyPattern.test(url) || colonPattern.test(url)) {
			url = url.replace(curlyPattern, placeholderValue).replace(colonPattern, placeholderValue);
			usedTemplate = true;
		}
	}

	if (!usedTemplate && paramNames.length > 0) {
		const suffix = paramNames.map((paramName) => '<' + paramName + '>').join('/');
		url = url.replace(/\/+$/u, '') + '/' + suffix;
	}

	return url;
};

const buildAutoFetchExample = (doc: (typeof docs)[number]): { key: string; label: string; content: string } | null => {
	const methodTag = doc.tags.find((tag) => tag.name.toLowerCase() === 'method');
	const methodValue = methodTag?.value.trim().toUpperCase();
	if (!methodValue) return null;
	const fetchUrl = buildFetchUrl(doc);

	const requestLines = ["method: '" + methodValue + "'"];
	if (doc.headers) {
		requestLines.push('headers: ' + toFetchHeadersLiteral(doc.headers));
	}
	if (doc.body) {
		requestLines.push('body: ' + toFetchBodyLiteral(doc.body));
	}

	const indentedRequest = requestLines
		.map((line) => line.split('\n').map((segment) => '  ' + segment).join('\n'))
		.join(',\n');

	return {
		key: 'generated-fetch',
		label: 'Fetch example',
		content:
			'const response = await fetch(' + JSON.stringify(fetchUrl) + ', {\n' +
			indentedRequest +
			"\n});\n\nconst data = await response.json();\nconsole.log(data);"
	};
};

/** Resolves a single docs entry by slug for the detail page. */
export const load = async ({ params }: Parameters<PageServerLoad>[0]) => {
	const doc = docs.find((entry) => entry.slug === params.slug);
	if (!doc) {
		throw error(404, 'Documentation entry not found');
	}

	const authorTag = doc.tags.find((tag) => tag.name.toLowerCase() === 'author');
	const resolvedAuthor = authorTag ? resolveAuthor(authorTag.value) : null;
	const inferredResponse = doc.response ? null : extractJsonBlock(doc.description);
	const docDescription = inferredResponse ? inferredResponse.remainder : doc.description;
	const responseValue = doc.response || inferredResponse?.value || '';
	const rawExamples = [
		...(() => {
			const generatedExample = buildAutoFetchExample(doc);
			return generatedExample ? [generatedExample] : [];
		})(),
		...doc.examples.map((example, index) => splitExampleContent(example, index))
	];
	const highlightedExamples: HighlightedExample[] = await Promise.all(
		rawExamples.map(async (example) => ({
			key: example.key,
			label: example.label,
			html: await highlightCode(example.content, example.language)
		}))
	);

	return {
		doc,
		author: resolvedAuthor?.profile ?? null,
		authorKey: resolvedAuthor?.key ?? null,
		docDescription,
		responseValue,
		highlighted: {
			signature: doc.signature ? await highlightCode(doc.signature, languageFromFilePath(doc.filePath)) : null,
			headers: doc.headers ? await highlightCode(doc.headers, 'json') : null,
			body: doc.body ? await highlightCode(doc.body, 'json') : null,
			returns:
				doc.returns && (isJsonBlock(doc.returns) || isTypeObject(doc.returns))
					? await highlightCode(doc.returns, 'typescript')
					: null,
			response: responseValue ? await highlightCode(responseValue, 'json') : null,
			examples: highlightedExamples
		}
	};
};
