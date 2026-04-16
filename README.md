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
 * @title Get User
 * @group API/Users
 * @description Fetch a single user by id.
 * Includes team membership when requested.
 * @route GET /api/users/:userId
 * @status 200 OK
 * @auth Bearer token
 * @method GET
 * @param userId Unique identifier for the user.
 * @param includeTeams Set to true to include related team membership data.
 * @fetchUrl https://api.example.com/users/{userId}?includeTeams=true
 * @headers {"Authorization": "Bearer <token>"}
 * @response {"id": "usr_123", "email": "ada@example.com"}
 * @author akcodeworks
 */
export async function getUser(userId: string) {
	// ...
}
```

The docs generator only treats a block as documentation when it starts with `@auto-doc`.

After that, `sveltejsdoc` reads first-class tags like `@title`, `@group`, `@description`, `@param`, `@returns`, `@response`, `@headers`, `@body`, `@fetchUrl`, `@example`, and `@author`.

Any other tag is still preserved and rendered as a generic metadata tag. That is useful for things like `@route`, `@status`, `@auth`, `@deprecated`, or your own project-specific tags.

If a tag value, `@returns` value, `@response` block, or a JSON block inside the description contains valid JSON or an object-like structure, `sveltejsdoc` will render it in a structured code block automatically.

## Supported Tags

These tags have built-in behavior:

`@auto-doc`
: Marks the JSDoc block as a documentation entry. This must be the first non-empty tag in the block.

`@title`
: Overrides the inferred title.

`@group`
: Groups entries in the generated docs navigation. Nested paths such as `API/Users` are supported.

`@description`
: Overrides the description body. This can span multiple lines.

`@displayPath`, `@display-path`, `@doc-displayPath`, `@doc-display-path`
: Overrides the source label shown in the docs instead of the default `path:line` value.

`@param`
: Adds a parameter row. Parameters are kept in the same order you write them.

`@returns`, `@return`
: Adds a return value section.

`@response`
: Adds a response section, usually for API examples.

`@headers`
: Adds a headers section and is also used by the generated fetch example.

`@body`
: Adds a body section and is also used by the generated fetch example.

`@fetchUrl`, `@fetch-url`
: Overrides the URL used in the generated fetch example.

`@example`
: Adds a highlighted example block. You can provide multiple examples in the same doc block.

`@author`
: Links the entry to a configured author profile when the tag value matches an author key.

Any other tag is rendered as a generic metadata badge or structured block.

## Multi-Line Tags

These tags can span multiple lines:

- `@description`
- `@returns`
- `@response`
- `@headers`
- `@body`
- `@fetchUrl`
- `@example`
- `@param`
- unknown custom tags

Example:

```ts
/**
 * @auto-doc
 * @title Create User
 * @description Create a new user account.
 * Requires authentication and returns the created record.
 * @body {
 *   "email": "ada@example.com",
 *   "profile": {
 *     "displayName": "Ada"
 *   }
 * }
 */
```

## Fetch Example Generation

If a doc block includes `@method`, `sveltejsdoc` generates a fetch example automatically.

The generated example uses, in order:

1. `@fetchUrl` when provided
2. the path from `@route` when present
3. the fallback `https://api.example.com/endpoint`

It also pulls in:

- `@headers` for the request headers
- `@body` for the request body

### How `@fetchUrl` Works

Use `@fetchUrl` when you want the generated fetch example to show a realistic URL instead of a generic fallback.

You can include named placeholders:

```ts
/**
 * @auto-doc
 * @method PATCH
 * @param tenantId Unique identifier for the tenant.
 * @param userId Unique identifier for the user.
 * @fetchUrl https://api.example.com/{tenantId}/users/{userId}/status
 */
```

That becomes a generated fetch URL like:

```ts
https://api.example.com/<tenantId>/users/<userId>/status
```

Route-style placeholders from `@route` also work, for example `:tenantId` and `:userId`.

If you provide params but no placeholders, `sveltejsdoc` appends them in the same order they appear in the doc block.

Example:

```ts
/**
 * @auto-doc
 * @method GET
 * @param tenantId Tenant id.
 * @param userId User id.
 * @fetchUrl https://api.example.com/users
 */
```

This produces a fetch URL like:

```ts
https://api.example.com/users/<tenantId>/<userId>
```

### Labeling Examples

If the first line of an `@example` block looks like a short label, it is used as the example label.

Example:

```ts
/**
 * @auto-doc
 * @example cURL
 * curl -X DELETE https://api.example.com/users/usr_123
 * @example JavaScript
 * await fetch('https://api.example.com/users/usr_123', { method: 'DELETE' });
 */
```

The docs page will show separate labeled examples for `cURL` and `JavaScript`.

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

## Custom Tags

You can add your own tags and they will still appear in the docs.

For example:

```ts
/**
 * @auto-doc
 * @title Update User Status
 * @route PATCH /api/tenants/:tenantId/users/:userId/status
 * @status 200 OK
 * @auth Bearer token
 * @deprecated Use `PATCH /api/v2/users/:userId/status` instead.
 */
```

Built-in tags such as `@headers`, `@body`, and `@fetchUrl` are handled specially and do not show up as generic metadata badges.

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
