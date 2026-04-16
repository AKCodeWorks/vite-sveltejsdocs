import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import type { Plugin } from 'vite';
import { DEFAULT_EXTENSIONS } from './constants.js';
import { walk } from './discovery.js';
import { normalize } from './helpers.js';
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
} from './output.js';
import { parseFileDocs } from './parser.js';
import type {
  AutoDocEntry,
  AutoDocSnapshot,
  DocHistoryVersionRecord,
  JsAutoDocsOptions
} from './types.js';

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

/**
 * @auto-doc
 * @title jsAutoDocs Plugin Factory
 * @group Plugin API
 * Creates the Vite plugin that generates docs data from `@auto-doc` JSDoc blocks.
 * @param options Optional root, scan directory, output file, and extension settings.
 * @returns A Vite plugin instance that runs on build and dev server events.
 */
export const jsAutoDocs = (options: JsAutoDocsOptions = {}): Plugin => {
  const root = options.root ?? process.cwd();
  const scanDir = options.scanDir ?? path.join(root, 'src');
  const outFile = options.outFile ?? path.join(root, 'src/routes/docs/generated.ts');
  const docsDir = path.dirname(outFile);
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
  const versionsDir = path.join(slugDir, 'versions', '[version]');
  const versionPageOutFile = path.join(versionsDir, '+page.svelte');
  const versionPageTsOutFile = path.join(versionsDir, '+page.ts');
  const authorDir = path.join(docsDir, 'authors', '[authorKey]');
  const authorPageOutFile = path.join(authorDir, '+page.svelte');
  const authorPageTsOutFile = path.join(authorDir, '+page.ts');
  const includeExtensions = new Set(options.includeExtensions ?? DEFAULT_EXTENSIONS);
  const includeInProduction = options.enableInProductionBuild === true;
  const maxVersions = Math.max(1, Math.floor(options.maxVersions ?? 15));
  let generating = false;
  let pendingRegenerate: NodeJS.Timeout | null = null;

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
    examples: doc.examples,
    tags: doc.tags
  });

  const serializeDocForHash = (doc: AutoDocEntry): string => JSON.stringify(toSnapshot(doc));

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

  const loadHistory = async (): Promise<DocHistoryStore> => {
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
                  examples: [],
                  tags: []
                }
              };
            }

            if (entry && typeof entry === 'object') {
              return {
                version: String((entry as { version?: string }).version ?? ''),
                changedAt: String((entry as { changedAt?: string }).changedAt ?? record.lastModified ?? new Date(0).toISOString()),
                contentHash: String((entry as { contentHash?: string }).contentHash ?? record.contentHash ?? ''),
                snapshot: (entry as { snapshot?: AutoDocSnapshot }).snapshot ?? {
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
                  examples: [],
                  tags: []
                }
              };
            }

            return null;
          })
          .filter((entry): entry is DocHistoryVersionRecord => Boolean(entry && entry.version));

        upgraded[key] = {
          contentHash: record.contentHash,
          lastModified: record.lastModified,
          versions: normalizedVersions
        };
      }

      return upgraded;
    } catch {
      return {};
    }
  };

  const saveHistory = async (history: DocHistoryStore): Promise<void> => {
    await writeFileIfChanged(historyOutFile, `${JSON.stringify(history, null, 2)}\n`);
  };

  const applyVersioning = async (docs: AutoDocEntry[]): Promise<VersionedDocEntry[]> => {
    const history = await loadHistory();
    const now = new Date();
    const nowIso = now.toISOString();
    const nextHistory: DocHistoryStore = {};

    const versionedDocs = docs.map((doc) => {
      const key = doc.id;
      const contentHash = contentHashForDoc(doc);
      const previous = history[key];

      if (!previous) {
        const firstVersion = makeCalver(now, []);
        const snapshot = toSnapshot(doc);
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

      if (previous.contentHash !== contentHash) {
        const nextVersion = makeCalver(now, previous.versions.map((entry) => entry.version));
        const snapshot = toSnapshot(doc);
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
          snapshot: toSnapshot(doc)
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

    await saveHistory(nextHistory);
    return versionedDocs;
  };

  const writeFileIfChanged = async (targetPath: string, content: string): Promise<void> => {
    let current = '';
    try {
      current = await fs.readFile(targetPath, 'utf8');
    } catch {
      current = '';
    }

    if (current === content) return;
    await fs.writeFile(targetPath, content, 'utf8');
  };

  /**
   * @auto-doc
   * @title Docs Regeneration Routine
   * @group Plugin Runtime
   * Regenerates docs output from the current source tree and writes the generated module.
   * @returns A promise that resolves when generation completes.
   */
  const generateDocs = async (isProductionBuild: boolean): Promise<void> => {
    if (generating) return;
    generating = true;
    try {
      await fs.mkdir(docsDir, { recursive: true });
      await fs.rm(legacyGroupDir, { recursive: true, force: true });
      await fs.mkdir(groupDir, { recursive: true });
      await fs.mkdir(slugDir, { recursive: true });
      await fs.mkdir(versionsDir, { recursive: true });
      await fs.mkdir(authorDir, { recursive: true });

      const docsEnabled = !isProductionBuild || includeInProduction;
      const docs = docsEnabled
        ? (
          await Promise.all(
            (await walk(scanDir, includeExtensions, outFile)).map((filePath) => parseFileDocs(filePath, root))
          )
        )
          .flat()
          .sort((a, b) => a.filePath.localeCompare(b.filePath) || a.line - b.line)
        : [];

      const versionedDocs = docsEnabled ? await applyVersioning(docs) : [];

      const history = await loadHistory();
      const generatedContent = createGeneratedModule(versionedDocs, options.authors ?? {}, history);
      const settingsContent = createDocsSettingsModule(docsEnabled);
      const layoutTsContent = createDocsLayoutTsModule();
      const layoutContent = createDocsLayoutSvelteModule(
        options.docsTitle ?? 'SvelteJSDoc',
        options.logo,
        options.navbar?.collapsed ?? true
      );
      const indexPageContent = createDocsIndexPageSvelteModule(options.index ?? {});
      const indexPageTsContent = createDocsIndexPageTsModule();
      const groupPageContent = createDocsGroupPageSvelteModule();
      const groupPageTsContent = createDocsGroupPageTsModule();
      const slugPageContent = createDocsSlugPageSvelteModule(options.collapseJson ?? false);
      const slugPageTsContent = createDocsSlugPageTsModule();
      const versionPageContent = createDocsVersionPageSvelteModule();
      const versionPageTsContent = createDocsVersionPageTsModule();
      const authorPageContent = createDocsAuthorPageSvelteModule();
      const authorPageTsContent = createDocsAuthorPageTsModule();
      await writeFileIfChanged(outFile, generatedContent);
      await writeFileIfChanged(settingsOutFile, settingsContent);
      await writeFileIfChanged(layoutTsOutFile, layoutTsContent);
      await writeFileIfChanged(layoutOutFile, layoutContent);
      await writeFileIfChanged(indexPageOutFile, indexPageContent);
      await writeFileIfChanged(indexPageTsOutFile, indexPageTsContent);
      await writeFileIfChanged(groupPageOutFile, groupPageContent);
      await writeFileIfChanged(groupPageTsOutFile, groupPageTsContent);
      await writeFileIfChanged(slugPageOutFile, slugPageContent);
      await writeFileIfChanged(slugPageTsOutFile, slugPageTsContent);
      await writeFileIfChanged(versionPageOutFile, versionPageContent);
      await writeFileIfChanged(versionPageTsOutFile, versionPageTsContent);
      await writeFileIfChanged(authorPageOutFile, authorPageContent);
      await writeFileIfChanged(authorPageTsOutFile, authorPageTsContent);
    } catch (error) {
      console.error('[js-auto-docs] Failed to generate docs:', error);
    } finally {
      generating = false;
    }
  };

  return {
    name: 'js-auto-docs',
    buildStart: async () => {
      await generateDocs(true);
    },
    closeBundle: async () => {
      await generateDocs(true);

      // Force final visibility state for production artifacts.
      const docsEnabled = includeInProduction;
      const finalSettings = createDocsSettingsModule(docsEnabled);
      await writeFileIfChanged(settingsOutFile, finalSettings);

      if (!docsEnabled) {
        const emptyGenerated = createGeneratedModule([], options.authors ?? {});
        await writeFileIfChanged(outFile, emptyGenerated);
      }
    },
    configureServer(server) {
      if (process.env.NODE_ENV === 'production') return;
      void generateDocs(false);
      const outputAbsolute = path.resolve(outFile);
      const layoutAbsolute = path.resolve(layoutOutFile);
      const layoutTsAbsolute = path.resolve(layoutTsOutFile);
      const settingsAbsolute = path.resolve(settingsOutFile);
      const indexPageAbsolute = path.resolve(indexPageOutFile);
      const indexPageTsAbsolute = path.resolve(indexPageTsOutFile);
      const groupPageAbsolute = path.resolve(groupPageOutFile);
      const groupPageTsAbsolute = path.resolve(groupPageTsOutFile);
      const slugPageAbsolute = path.resolve(slugPageOutFile);
      const slugPageTsAbsolute = path.resolve(slugPageTsOutFile);
      const versionPageAbsolute = path.resolve(versionPageOutFile);
      const versionPageTsAbsolute = path.resolve(versionPageTsOutFile);
      const authorPageAbsolute = path.resolve(authorPageOutFile);
      const authorPageTsAbsolute = path.resolve(authorPageTsOutFile);
      const rootAbsolute = path.resolve(root);

      /**
       * @auto-doc
       * @title Watcher Change Handler
       * @group Plugin Runtime
       * Handles file-system watcher changes and triggers docs regeneration when relevant.
       * @param changed File path emitted by the Vite watcher.
       * @returns No value.
       */
      const trigger = (changed: string): void => {
        const absChanged = path.resolve(changed);
        if (absChanged === outputAbsolute) return;
        if (absChanged === layoutAbsolute) return;
        if (absChanged === layoutTsAbsolute) return;
        if (absChanged === settingsAbsolute) return;
        if (absChanged === indexPageAbsolute) return;
        if (absChanged === indexPageTsAbsolute) return;
        if (absChanged === groupPageAbsolute) return;
        if (absChanged === groupPageTsAbsolute) return;
        if (absChanged === slugPageAbsolute) return;
        if (absChanged === slugPageTsAbsolute) return;
        if (absChanged === versionPageAbsolute) return;
        if (absChanged === versionPageTsAbsolute) return;
        if (absChanged === authorPageAbsolute) return;
        if (absChanged === authorPageTsAbsolute) return;
        if (!absChanged.startsWith(rootAbsolute)) return;
        if (!includeExtensions.has(path.extname(absChanged))) return;

        if (pendingRegenerate) {
          clearTimeout(pendingRegenerate);
        }

        pendingRegenerate = setTimeout(() => {
          pendingRegenerate = null;
          void generateDocs(false).then(() => {
            const outputPath = normalize(path.relative(rootAbsolute, outputAbsolute));
            const moduleNode = server.moduleGraph.getModuleById(path.join(rootAbsolute, outputPath));
            if (moduleNode) {
              server.moduleGraph.invalidateModule(moduleNode);
              server.ws.send({ type: 'full-reload' });
            }
          });
        }, 120);
      };

      server.watcher.on('add', trigger);
      server.watcher.on('change', trigger);
      server.watcher.on('unlink', trigger);
    }
  };
};
