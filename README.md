# sveltejsdoc

`sveltejsdoc` generates a standalone SvelteKit documentation app from JSDoc comments in your project.

It scans your source files, builds a docs site into `.sveltejsdoc`, and serves that app with live reload while you work.

## Install

```sh
npm install -D sveltejsdoc
```

You can also use `bun`, `pnpm`, or `yarn` if that is what your project already uses.

## Quick Start

1. Add JSDoc blocks to the code you want documented.
2. Start the docs server.
3. Open the generated docs app in your browser.

```sh
npx sveltejsdoc start
```

By default this:

- scans `./src`
- generates a standalone docs app in `.sveltejsdoc`
- starts the docs app on `http://127.0.0.1:5111`
- watches matching source files and regenerates docs on change

## JSDoc Example

```ts
/**
 * @auto-doc
 * @title User Lookup
 * @group API
 * Finds a user by id.
 * @param id User identifier.
 * @returns The matching user record.
 * @author akcodeworks
 */
export async function getUser(id: string) {
	// ...
}
```

The docs generator reads tags like `@title`, `@group`, `@param`, `@returns`, and `@author` from your JSDoc.

If a tag value, `@returns` value, `@response` block, or a JSON block inside the description contains valid JSON or an object-like structure, `sveltejsdoc` will render it in a structured code block automatically.

## CLI Usage

```sh
sveltejsdoc start [--root path] [--config path] [--scanDir path] [--port 5111] [--host 127.0.0.1]
```

### CLI Options

`--root`
: Project root to use when resolving config, source files, and the generated docs app.

`--config`
: Explicit path to a config file. If omitted, `sveltejsdoc` looks for a config file in the project root.

`--scanDir`
: Directory to scan for source files. Defaults to `src` under the selected root.

`--port`
: Port for the generated docs app. Defaults to `5111`.

`--host`
: Host interface for the generated docs app. Defaults to `127.0.0.1`.

CLI flags override config-file values when both are provided.

## Config File

You can configure `sveltejsdoc` with any of these files at the project root:

- `sveltejsdoc.config.ts`
- `sveltejsdoc.config.js`
- `sveltejsdoc.config.mts`
- `sveltejsdoc.config.mjs`
- `sveltejsdoc.config.cts`
- `sveltejsdoc.config.cjs`

Example:

```ts
import { defineConfig } from 'sveltejsdoc';

export default defineConfig({
	root: '.',
	scanDir: './src',
	appDirName: '.sveltejsdoc',
	port: 5111,
	host: '127.0.0.1',
	docsTitle: 'Project Docs',
	logo: './static/logo.svg',
	collapseJson: true,
	includeExtensions: ['.ts', '.js', '.svelte'],
	maxVersions: 15,
	navbar: {
		collapsed: true
	},
	index: {
		tagline: 'REFERENCE',
		heading: 'API Docs',
		description: 'Generated API documentation for this project.'
	},
	authors: {
		akcodeworks: {
			name: 'AK Code Works',
			title: 'Maintainer',
			username: 'akcodeworks',
			bio: 'Builds and maintains the package.',
			imageUrl: './static/author.png',
			email: 'hello@example.com',
			links: {
				github: 'https://github.com/AKCodeWorks'
			}
		}
	}
});
```

## Available Config Options

### Core Options

`root?: string`
: Project root used to resolve paths and config loading. Defaults to the current working directory.

`scanDir?: string`
: Directory to scan for source files. Defaults to `src` under `root`.

`appDirName?: string`
: Name of the generated standalone docs app directory. Defaults to `.sveltejsdoc`.

`host?: string`
: Host interface used by the generated Vite dev server. Defaults to `127.0.0.1`.

`port?: number`
: Port used by the generated Vite dev server. Defaults to `5111`.

`configFile?: string`
: Internal or advanced override for the resolved config file path. Normally you should use the CLI `--config` flag instead.

### Content And UI Options

`docsTitle?: string`
: Title shown in the docs layout and sidebar header. Defaults to `SvelteJSDoc`.

`logo?: string`
: Logo path or URL shown in the docs sidebar or header.

`collapseJson?: boolean`
: Controls whether JSON-like type displays are rendered in collapsed form on doc detail pages. Defaults to `false`.

`navbar?: { collapsed?: boolean }`
: Controls the sidebar navigation presentation. `collapsed` defaults to `true`.

`index?: { tagline?: string; heading?: string; description?: string }`
: Controls the home page hero content.

### Scan And History Options

`includeExtensions?: string[]`
: File extensions to include while scanning. Defaults to the package's built-in source extension list.

`maxVersions?: number`
: Maximum number of historical versions stored per generated doc entry. Defaults to `15`.

### Author Options

`authors?: Record<string, AuthorProfile>`
: Configured author profiles used on the docs home page and on doc detail pages when an `@author` tag matches the key.

`AuthorProfile`
:

```ts
type AuthorProfile = {
	name: string;
	title?: string;
	username?: string;
	bio?: string;
	imageUrl?: string;
	email?: string;
	address?: string;
	phone?: Partial<Record<'mobile' | 'office' | 'home' | 'other', string>>;
	links?: Record<string, string>;
};
```

Example:

```ts
authors: {
	akcodeworks: {
		name: 'AK Code Works',
		username: 'akcodeworks'
	}
}
```

Then reference the author in JSDoc:

```ts
/**
 * @auto-doc
 * @author akcodeworks
 */
```

### Exported But Not Currently Used By The CLI

These options still exist in the exported types, but the current standalone CLI flow does not actively use them:

`outFile?: string`
: The CLI always writes generated docs data into the generated app under `.sveltejsdoc/src/routes/docs/generated.ts`.

`enableInProductionBuild?: boolean`
: Present in the exported type surface, but not currently consumed by the standalone docs runtime.

## Generated Output

When you run `sveltejsdoc start`, the package creates a standalone docs app with files like:

```text
.sveltejsdoc/
  src/routes/docs/
    +page.svelte
    +page.ts
    generated.ts
    history.json
```

You should treat `.sveltejsdoc` as generated output.

## How Author Display Works

Authors only show up when both of these are true:

1. The `authors` object in your config contains a matching author key.
2. A documented symbol includes an `@author` tag whose value resolves to that key.

If either one is missing, the author will not appear on the home screen or the detail page.

## Public API

The package currently exports:

- `defineConfig`
- `loadUserConfig`
- `startStandaloneDocsServer`
- `DEFAULT_DOCS_APP_DIRNAME`
- `DEFAULT_DOCS_PORT`
- config and author-related TypeScript types

Typical usage for application projects is the CLI plus `defineConfig`.

## Development In This Repo

Useful commands while working on the package itself:

```sh
bun install
bun run check
bun run lint
bun run prepack
npm pack
```

`npm pack` builds the distributable tarball for local install testing.
