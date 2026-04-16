export {
	DEFAULT_DOCS_APP_DIRNAME,
	DEFAULT_DOCS_PORT,
	defineConfig,
	loadUserConfig,
	startStandaloneDocsServer
} from './cli-support.js';

export type { StandaloneDocsOptions, SvelteJSDocConfig } from './cli-support.js';
export type {
	AuthorLinks,
	AuthorProfile,
	JsAutoDocsIndexOptions,
	JsAutoDocsNavbarOptions,
	JsAutoDocsOptions
} from './plugin-internals/types.js';
