import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import chokidar from 'chokidar';
import { createServer, loadConfigFromFile } from 'vite';
import { DEFAULT_EXTENSIONS, EXCLUDED_DIRS } from './plugin-internals/constants.js';
import { walk } from './plugin-internals/discovery.js';
import { normalize, slugify } from './plugin-internals/helpers.js';
import {
	createDocsAuthorPageSvelteModule,
	createDocsAuthorPageTsModule,
	createDocsGroupPageSvelteModule,
	createDocsGroupPageTsModule,
	createDocsIndexPageSvelteModule,
	createDocsIndexPageTsModule,
	createDocsLayoutSvelteModule,
	createDocsLayoutTsModule,
	createDocsSettingsModule,
	createDocsSlugPageSvelteModule,
	createDocsSlugPageTsModule,
	createDocsVersionPageSvelteModule,
	createDocsVersionPageTsModule,
	createGeneratedModule
} from './plugin-internals/output.js';
import { parseFileDocs } from './plugin-internals/parser.js';
import type {
	AutoDocEntry,
	AutoDocSnapshot,
	DocHistoryVersionRecord,
	JsAutoDocsOptions
} from './plugin-internals/types.js';

export const DEFAULT_DOCS_APP_DIRNAME = '.sveltejsdoc';
export const DEFAULT_DOCS_PORT = 5111;

type VersionedDocEntry = AutoDocEntry & {
	lastModified: string;
	versionHistory: string[];
};

type DocHistoryRecord = {
	contentHash: string;
	versions: DocHistoryVersionRecord[];
	lastModified: string;
};

type DocHistoryStore = Record<string, DocHistoryRecord>;

export type StandaloneDocsOptions = JsAutoDocsOptions & {
	appDirName?: string;
	host?: string;
	port?: number;
	configFile?: string;
};

export type SvelteJSDocConfig = StandaloneDocsOptions;

const require = createRequire(import.meta.url);
const CONFIG_NAMES = [
	'sveltejsdoc.config.ts',
	'sveltejsdoc.config.js',
	'sveltejsdoc.config.mts',
	'sveltejsdoc.config.mjs',
	'sveltejsdoc.config.cts',
	'sveltejsdoc.config.cjs'
];

const GENERATED_PACKAGE_NAME = 'vite-sveltejsdocs-generated';

export const defineConfig = (config: SvelteJSDocConfig): SvelteJSDocConfig => config;

const packageJsonTemplate = (): string =>
	`${JSON.stringify(
		{
			name: GENERATED_PACKAGE_NAME,
			private: true,
			type: 'module',
			scripts: {
				dev: 'vite dev',
				build: 'vite build',
				preview: 'vite preview'
			}
		},
		null,
		2
	)}\n`;

const svelteConfigTemplate = (): string => `import adapter from '@sveltejs/adapter-auto';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		runes: true
	},
	kit: {
		adapter: adapter()
	}
};

export default config;
`;

const viteConfigTemplate = (port: number, host: string, root: string): string => `import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		host: ${JSON.stringify(host)},
		port: ${port},
		strictPort: true,
		fs: {
			allow: [${JSON.stringify(root)}, ${JSON.stringify(path.join(root, 'node_modules'))}]
		}
	}
});
`;

const tsconfigTemplate = (): string => `${JSON.stringify(
	{
		extends: './.svelte-kit/tsconfig.json',
		compilerOptions: {
			rewriteRelativeImportExtensions: true,
			allowJs: true,
			checkJs: true,
			forceConsistentCasingInFileNames: true,
			resolveJsonModule: true,
			skipLibCheck: true,
			sourceMap: true,
			strict: true,
			module: 'NodeNext',
			moduleResolution: 'NodeNext'
		}
	},
	null,
	2
)}\n`;

const appHtmlTemplate = (): string => `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		%sveltekit.head%
	</head>
	<body data-sveltekit-preload-data="hover">
		<div style="display: contents">%sveltekit.body%</div>
	</body>
</html>
`;

const rootLayoutTemplate = (): string => `<script lang="ts">
	import '../app.css';

	let { children }: { children: import('svelte').Snippet } = $props();
</script>

{@render children()}
`;

const rootPageTemplate = (): string => `import { redirect } from '@sveltejs/kit';

export const load = async () => {
	throw redirect(307, '/docs');
};
`;

const appCssTemplate = (): string => `@import 'tailwindcss';

:root {
	color-scheme: light;
}

body {
	margin: 0;
	font-family: 'IBM Plex Sans', 'Inter', sans-serif;
	background: #f8fafc;
	color: #0f172a;
}

a {
	color: inherit;
	text-decoration: none;
}

* {
	box-sizing: border-box;
}
`;

const rootPackagePath = (subpath: string): string => {
	const packageRoot = path.dirname(require.resolve('@sveltejs/kit/package.json'));
	return path.join(packageRoot, subpath);
};

const resolvePathOption = (root: string, value: string | undefined): string | undefined => {
	if (!value) return undefined;
	return path.isAbsolute(value) ? value : path.resolve(root, value);
};

export const loadUserConfig = async (root: string, explicitConfigFile?: string): Promise<SvelteJSDocConfig> => {
	const resolvedRoot = path.resolve(root);
	const configFile = explicitConfigFile
		? resolvePathOption(resolvedRoot, explicitConfigFile)
		: CONFIG_NAMES.map((candidate) => path.join(resolvedRoot, candidate)).find((candidate) => require('node:fs').existsSync(candidate));

	if (!configFile) {
		return {};
	}

	const loaded = await loadConfigFromFile(
		{ command: 'serve', mode: 'development', isSsrBuild: false, isPreview: false },
		configFile,
		resolvedRoot,
		'silent',
		undefined,
		'bundle'
	);

	const config = (loaded?.config as SvelteJSDocConfig | undefined) ?? {};
	return {
		...config,
		root: resolvePathOption(resolvedRoot, config.root) ?? resolvedRoot,
		scanDir: resolvePathOption(resolvePathOption(resolvedRoot, config.root) ?? resolvedRoot, config.scanDir),
		configFile
	};
};

const importKitModule = async <T>(subpath: string): Promise<T> => {
	const modulePath = rootPackagePath(subpath);
	return import(pathToFileURL(modulePath).href) as Promise<T>;
};

const toSnapshot = (doc: AutoDocEntry): AutoDocSnapshot => ({
	group: doc.group,
	title: doc.title,
	summary: doc.summary,
	description: doc.description,
	jsdocRaw: doc.jsdocRaw,
	signature: doc.signature,
	displayPath: doc.displayPath,
	params: doc.params,
	returns: doc.returns,
	response: doc.response,
	headers: doc.headers,
	body: doc.body,
	fetchUrl: doc.fetchUrl,
	examples: doc.examples,
	tags: doc.tags
});

const normalizeSnapshot = (snapshot: Partial<AutoDocSnapshot> | undefined): AutoDocSnapshot => ({
	group: snapshot?.group ?? '',
	title: snapshot?.title ?? '',
	summary: snapshot?.summary ?? '',
	description: snapshot?.description ?? '',
	jsdocRaw: snapshot?.jsdocRaw ?? '',
	signature: snapshot?.signature ?? '',
	displayPath: snapshot?.displayPath ?? '',
	params: snapshot?.params ?? [],
	returns: snapshot?.returns ?? '',
	response: snapshot?.response ?? '',
	headers: snapshot?.headers ?? '',
	body: snapshot?.body ?? '',
	fetchUrl: snapshot?.fetchUrl ?? '',
	examples: snapshot?.examples ?? [],
	tags: snapshot?.tags ?? []
});

const serializeSnapshotForHash = (snapshot: AutoDocSnapshot): string => JSON.stringify(normalizeSnapshot(snapshot));

const serializeDocForHash = (doc: AutoDocEntry): string => serializeSnapshotForHash(toSnapshot(doc));

const contentHashForSnapshot = (snapshot: AutoDocSnapshot): string =>
	createHash('sha1').update(serializeSnapshotForHash(snapshot)).digest('hex');

const contentHashForDoc = (doc: AutoDocEntry): string =>
	createHash('sha1').update(serializeDocForHash(doc)).digest('hex');

const makeCalver = (now: Date, existingVersions: string[]): string => {
	const yy = String(now.getUTCFullYear()).slice(-2);
	const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
	const dd = String(now.getUTCDate()).padStart(2, '0');
	const prefix = `${yy}.${mm}.${dd}`;
	const next = existingVersions.filter((version) => version.startsWith(`${prefix}.`)).length + 1;
	return `${prefix}.${next}`;
};

const writeFileIfChanged = async (targetPath: string, content: string): Promise<void> => {
	try {
		const current = await fs.readFile(targetPath, 'utf8');
		if (current === content) return;
	} catch {
		// File does not exist yet.
	}

	await fs.writeFile(targetPath, content, 'utf8');
};

const loadHistory = async (historyOutFile: string): Promise<DocHistoryStore> => {
	try {
		const raw = await fs.readFile(historyOutFile, 'utf8');
		const parsed = JSON.parse(raw) as DocHistoryStore;
		if (!parsed || typeof parsed !== 'object') return {};

		const upgraded: DocHistoryStore = {};
		for (const [key, record] of Object.entries(parsed)) {
			if (!record || typeof record !== 'object') continue;
			const versions = Array.isArray(record.versions) ? record.versions : [];

			const normalizedVersions: DocHistoryVersionRecord[] = versions
				.map((entry) => {
					if (typeof entry === 'string') {
						return {
							version: entry,
							changedAt: record.lastModified ?? new Date(0).toISOString(),
							contentHash: record.contentHash ?? '',
							snapshot: {
								group: '',
								title: '',
								summary: '',
								description: '',
								jsdocRaw: '',
								signature: '',
								displayPath: '',
								params: [],
								returns: '',
								response: '',
								headers: '',
								body: '',
								fetchUrl: '',
								examples: [],
								tags: []
							}
						};
					}

					if (entry && typeof entry === 'object') {
						return {
							version: String((entry as { version?: string }).version ?? ''),
							changedAt: String(
								(entry as { changedAt?: string }).changedAt ?? record.lastModified ?? new Date(0).toISOString()
							),
							contentHash: String((entry as { contentHash?: string }).contentHash ?? record.contentHash ?? ''),
							snapshot: normalizeSnapshot((entry as { snapshot?: AutoDocSnapshot }).snapshot)
						};
					}

					return null;
				})
				.filter((entry): entry is DocHistoryVersionRecord => Boolean(entry && entry.version));

			const dedupedVersions = normalizedVersions
				.slice()
				.reverse()
				.reduce<DocHistoryVersionRecord[]>((acc, entry) => {
					const normalizedSnapshot = normalizeSnapshot(entry.snapshot);
					const entryHash = entry.contentHash || contentHashForSnapshot(normalizedSnapshot);
					const previousKept = acc[acc.length - 1];

					if (previousKept) {
						const previousHash = previousKept.contentHash || contentHashForSnapshot(normalizeSnapshot(previousKept.snapshot));
						if (previousHash === entryHash) {
							return acc;
						}
					}

					acc.push({
						...entry,
						contentHash: entryHash,
						snapshot: normalizedSnapshot
					});
					return acc;
				}, [])
				.reverse();

			upgraded[key] = {
				contentHash:
					dedupedVersions[0]?.contentHash || record.contentHash || contentHashForSnapshot(normalizeSnapshot(dedupedVersions[0]?.snapshot)),
				lastModified: record.lastModified,
				versions: dedupedVersions
			};
		}

		return upgraded;
	} catch {
		return {};
	}
};

const saveHistory = async (historyOutFile: string, history: DocHistoryStore): Promise<void> => {
	await writeFileIfChanged(historyOutFile, `${JSON.stringify(history, null, 2)}\n`);
};

const assignUniqueSlugs = (docs: AutoDocEntry[]): AutoDocEntry[] => {
	const slugCounts = new Map<string, number>();

	return docs.map((doc) => {
		const baseSlug = slugify(doc.title);
		const nextCount = (slugCounts.get(baseSlug) ?? 0) + 1;
		slugCounts.set(baseSlug, nextCount);

		return {
			...doc,
			slug: nextCount === 1 ? baseSlug : `${baseSlug}-${nextCount}`
		};
	});
};

const applyVersioning = async (docs: AutoDocEntry[], historyOutFile: string, maxVersions: number): Promise<VersionedDocEntry[]> => {
	const history = await loadHistory(historyOutFile);
	const now = new Date();
	const nowIso = now.toISOString();
	const nextHistory: DocHistoryStore = {};

	const versionedDocs = docs.map((doc) => {
		const key = doc.id;
		const snapshot = toSnapshot(doc);
		const contentHash = contentHashForSnapshot(snapshot);
		const previous = history[key];
		const latestStoredVersion = previous?.versions[0] ?? null;
		const latestStoredSnapshot = latestStoredVersion ? normalizeSnapshot(latestStoredVersion.snapshot) : null;
		const latestStoredHash = latestStoredVersion
			? latestStoredVersion.contentHash || contentHashForSnapshot(latestStoredSnapshot)
			: previous?.contentHash || '';

		if (!previous) {
			const firstVersion = makeCalver(now, []);
			const created: DocHistoryRecord = {
				contentHash,
				versions: [
					{
						version: firstVersion,
						changedAt: nowIso,
						contentHash,
						snapshot
					}
				],
				lastModified: nowIso
			};
			nextHistory[key] = created;
			return {
				...doc,
				lastModified: created.lastModified,
				versionHistory: created.versions.map((entry) => entry.version)
			};
		}

		if (latestStoredHash !== contentHash) {
			if (latestStoredSnapshot && serializeSnapshotForHash(latestStoredSnapshot) === serializeSnapshotForHash(snapshot)) {
				const stableVersions = previous.versions.slice(0, maxVersions);
				if (stableVersions.length > 0) {
					stableVersions[0] = {
						...stableVersions[0],
						contentHash,
						snapshot
					};
				}

				const stable: DocHistoryRecord = {
					contentHash,
					versions: stableVersions,
					lastModified: previous.lastModified
				};
				nextHistory[key] = stable;
				return {
					...doc,
					lastModified: stable.lastModified,
					versionHistory: stable.versions.map((entry) => entry.version)
				};
			}

			const nextVersion = makeCalver(now, previous.versions.map((entry) => entry.version));
			const updated: DocHistoryRecord = {
				contentHash,
				versions: [
					{
						version: nextVersion,
						changedAt: nowIso,
						contentHash,
						snapshot
					},
					...previous.versions
				].slice(0, maxVersions),
				lastModified: nowIso
			};
			nextHistory[key] = updated;
			return {
				...doc,
				lastModified: updated.lastModified,
				versionHistory: updated.versions.map((entry) => entry.version)
			};
		}

		const stableVersions = previous.versions.slice(0, maxVersions);
		if (stableVersions.length > 0) {
			stableVersions[0] = {
				...stableVersions[0],
				contentHash,
				snapshot
			};
		}

		const stable: DocHistoryRecord = {
			contentHash,
			versions: stableVersions,
			lastModified: previous.lastModified
		};
		nextHistory[key] = stable;
		return {
			...doc,
			lastModified: stable.lastModified,
			versionHistory: stable.versions.map((entry) => entry.version)
		};
	});

	await saveHistory(historyOutFile, nextHistory);
	return versionedDocs;
};

const ensureDocsAppShell = async (appDir: string, root: string, port: number, host: string): Promise<void> => {
	const srcDir = path.join(appDir, 'src');
	const routesDir = path.join(srcDir, 'routes');
	await fs.mkdir(routesDir, { recursive: true });

	await writeFileIfChanged(path.join(appDir, 'package.json'), packageJsonTemplate());
	await writeFileIfChanged(path.join(appDir, 'svelte.config.js'), svelteConfigTemplate());
	await writeFileIfChanged(path.join(appDir, 'vite.config.ts'), viteConfigTemplate(port, host, root));
	await writeFileIfChanged(path.join(appDir, 'tsconfig.json'), tsconfigTemplate());
	await writeFileIfChanged(path.join(srcDir, 'app.html'), appHtmlTemplate());
	await writeFileIfChanged(path.join(srcDir, 'app.css'), appCssTemplate());
	await writeFileIfChanged(path.join(routesDir, '+layout.svelte'), rootLayoutTemplate());
	await writeFileIfChanged(path.join(routesDir, '+page.ts'), rootPageTemplate());
};

const syncGeneratedApp = async (appDir: string): Promise<void> => {
	const [{ load_config }, sync] = await Promise.all([
		importKitModule<{ load_config: (options?: { cwd?: string }) => Promise<unknown> }>('src/core/config/index.js'),
		importKitModule<{ all: (config: unknown, mode: string) => unknown }>('src/core/sync/sync.js')
	]);

	const config = await load_config({ cwd: appDir });
	sync.all(config, 'development');
};

const generateDocsApp = async (options: StandaloneDocsOptions): Promise<{ appDir: string; generatedModulePath: string }> => {
	const root = options.root ?? process.cwd();
	const appDirName = options.appDirName ?? DEFAULT_DOCS_APP_DIRNAME;
	const appDir = path.join(root, appDirName);
	const routeRoot = path.join(appDir, 'src', 'routes');
	const docsDir = path.join(routeRoot, 'docs');
	const outFile = path.join(docsDir, 'generated.ts');
	const layoutOutFile = path.join(docsDir, '+layout.svelte');
	const layoutTsOutFile = path.join(docsDir, '+layout.ts');
	const settingsOutFile = path.join(docsDir, 'settings.ts');
	const historyOutFile = path.join(docsDir, 'history.json');
	const indexPageOutFile = path.join(docsDir, '+page.svelte');
	const indexPageTsOutFile = path.join(docsDir, '+page.ts');
	const legacyGroupDir = path.join(docsDir, 'groups', '[group]');
	const groupDir = path.join(docsDir, 'groups', '[...groupPath]');
	const groupPageOutFile = path.join(groupDir, '+page.svelte');
	const groupPageTsOutFile = path.join(groupDir, '+page.ts');
	const slugDir = path.join(docsDir, '[slug]');
	const slugPageOutFile = path.join(slugDir, '+page.svelte');
	const slugPageTsOutFile = path.join(slugDir, '+page.ts');
	const slugPageServerOutFile = path.join(slugDir, '+page.server.ts');
	const versionsDir = path.join(slugDir, 'versions', '[version]');
	const versionPageOutFile = path.join(versionsDir, '+page.svelte');
	const versionPageTsOutFile = path.join(versionsDir, '+page.ts');
	const authorDir = path.join(docsDir, 'authors', '[authorKey]');
	const authorPageOutFile = path.join(authorDir, '+page.svelte');
	const authorPageTsOutFile = path.join(authorDir, '+page.ts');
	const includeExtensions = new Set(options.includeExtensions ?? DEFAULT_EXTENSIONS);
	const scanDir = options.scanDir ?? path.join(root, 'src');
	const maxVersions = Math.max(1, Math.floor(options.maxVersions ?? 15));

	await fs.mkdir(docsDir, { recursive: true });
	await fs.rm(legacyGroupDir, { recursive: true, force: true });
	await fs.mkdir(groupDir, { recursive: true });
	await fs.mkdir(slugDir, { recursive: true });
	await fs.mkdir(versionsDir, { recursive: true });
	await fs.mkdir(authorDir, { recursive: true });
	await fs.rm(slugPageTsOutFile, { force: true });

	const docs = (
		await Promise.all((await walk(scanDir, includeExtensions, outFile)).map((filePath) => parseFileDocs(filePath, root)))
	)
		.flat()
		.sort((a, b) => a.filePath.localeCompare(b.filePath) || a.line - b.line);

	const docsWithUniqueSlugs = assignUniqueSlugs(docs);

	const versionedDocs = await applyVersioning(docsWithUniqueSlugs, historyOutFile, maxVersions);
	const history = await loadHistory(historyOutFile);

	await Promise.all([
		writeFileIfChanged(outFile, createGeneratedModule(versionedDocs, options.authors ?? {}, history)),
		writeFileIfChanged(settingsOutFile, createDocsSettingsModule(true)),
		writeFileIfChanged(layoutTsOutFile, createDocsLayoutTsModule()),
		writeFileIfChanged(
			layoutOutFile,
			createDocsLayoutSvelteModule(options.docsTitle ?? 'SvelteJSDoc', options.logo, options.navbar?.collapsed ?? true)
		),
		writeFileIfChanged(indexPageOutFile, createDocsIndexPageSvelteModule(options.index ?? {})),
		writeFileIfChanged(indexPageTsOutFile, createDocsIndexPageTsModule()),
		writeFileIfChanged(groupPageOutFile, createDocsGroupPageSvelteModule()),
		writeFileIfChanged(groupPageTsOutFile, createDocsGroupPageTsModule()),
		writeFileIfChanged(slugPageOutFile, createDocsSlugPageSvelteModule(options.collapseJson ?? false)),
		writeFileIfChanged(slugPageServerOutFile, createDocsSlugPageTsModule(options.collapseJson ?? false)),
		writeFileIfChanged(versionPageOutFile, createDocsVersionPageSvelteModule()),
		writeFileIfChanged(versionPageTsOutFile, createDocsVersionPageTsModule()),
		writeFileIfChanged(authorPageOutFile, createDocsAuthorPageSvelteModule()),
		writeFileIfChanged(authorPageTsOutFile, createDocsAuthorPageTsModule())
	]);

	return {
		appDir,
		generatedModulePath: outFile
	};
};

const shouldIgnoreWatchPath = (root: string, appDir: string, changedPath: string): boolean => {
	const absolutePath = path.resolve(changedPath);
	if (!absolutePath.startsWith(path.resolve(root))) return true;
	if (absolutePath.startsWith(path.resolve(appDir))) return true;
	return [...EXCLUDED_DIRS].some((entry) => normalize(absolutePath).includes(`/${entry}/`));
};

export const startStandaloneDocsServer = async (options: StandaloneDocsOptions = {}): Promise<void> => {
	const root = path.resolve(options.root ?? process.cwd());
	const originalCwd = process.cwd();
	const host = options.host ?? '127.0.0.1';
	const port = options.port ?? DEFAULT_DOCS_PORT;
	const appDirName = options.appDirName ?? DEFAULT_DOCS_APP_DIRNAME;
	const appDir = path.join(root, appDirName);
	const scanDir = path.resolve(options.scanDir ?? path.join(root, 'src'));
	const includeExtensions = new Set(options.includeExtensions ?? DEFAULT_EXTENSIONS);

	await ensureDocsAppShell(appDir, root, port, host);
	await generateDocsApp({ ...options, root, appDirName, scanDir, port, host });
	process.chdir(appDir);
	await syncGeneratedApp(appDir);

	const viteServer = await createServer({
		configFile: path.join(appDir, 'vite.config.ts'),
		server: {
			host,
			port,
			strictPort: true
		}
	});

	await viteServer.listen();
	viteServer.printUrls();
	console.log(`[sveltejsdoc] Watching ${normalize(path.relative(root, scanDir) || scanDir)} and serving docs from ${normalize(path.relative(root, appDir))}`);

	let pendingTimer: NodeJS.Timeout | null = null;
	let generating = false;

	const regenerate = async (): Promise<void> => {
		if (generating) return;
		generating = true;
		try {
			await generateDocsApp({ ...options, root, appDirName, scanDir, port, host });
			await syncGeneratedApp(appDir);
			viteServer.ws.send({ type: 'full-reload' });
		} catch (error) {
			console.error('[sveltejsdoc] Failed to regenerate docs app:', error);
		} finally {
			generating = false;
		}
	};

	const scheduleRegenerate = (changedPath: string): void => {
		if (shouldIgnoreWatchPath(root, appDir, changedPath)) return;
		if (!includeExtensions.has(path.extname(changedPath))) return;

		if (pendingTimer) clearTimeout(pendingTimer);
		pendingTimer = setTimeout(() => {
			pendingTimer = null;
			void regenerate();
		}, 120);
	};

	const watcher = chokidar.watch(scanDir, {
		ignoreInitial: true,
		awaitWriteFinish: {
			stabilityThreshold: 120,
			pollInterval: 30
		}
	});

	watcher.on('add', scheduleRegenerate);
	watcher.on('change', scheduleRegenerate);
	watcher.on('unlink', scheduleRegenerate);

	const shutdown = async (): Promise<void> => {
		if (pendingTimer) {
			clearTimeout(pendingTimer);
			pendingTimer = null;
		}
		await watcher.close();
		await viteServer.close();
		process.chdir(originalCwd);
		process.exit(0);
	};

	process.once('SIGINT', () => {
		void shutdown();
	});
	process.once('SIGTERM', () => {
		void shutdown();
	});
};