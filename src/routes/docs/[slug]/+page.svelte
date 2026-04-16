<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const currentIndex = $derived(data.docs.findIndex((entry) => entry.slug === data.doc.slug));
	const prevDoc = $derived(currentIndex > 0 ? data.docs[currentIndex - 1] : null);
	const nextDoc = $derived(
		currentIndex >= 0 && currentIndex < data.docs.length - 1 ? data.docs[currentIndex + 1] : null
	);
	const methodTag = $derived(
		data.doc.tags.find((tag) => tag.name.toLowerCase() === 'method') ?? null
	);
	const nonAuthorTags = $derived(
		data.doc.tags.filter((tag) => {
			const normalized = tag.name.toLowerCase();
			return normalized !== 'author' && normalized !== 'method';
		})
	);
	const formattedLastModified = $derived(
		new Date(data.doc.lastModified).toLocaleString(undefined, {
			year: 'numeric',
			month: 'short',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		})
	);
	const docGroup = $derived(data.doc.group || 'Ungrouped');
	const docGroupSegments = $derived(
		docGroup
			.split('/')
			.map((segment) => segment.trim())
			.filter(Boolean)
	);
	const docGroupCrumbs = $derived(
		docGroupSegments.map((segment, index) => ({
			label: segment,
			path: docGroupSegments.slice(0, index + 1).join('/')
		}))
	);
	const groupHref = (groupPath: string): string =>
		'/docs/groups/' +
		groupPath
			.split('/')
			.map((segment) => encodeURIComponent(segment))
			.join('/');
	const collapseJson = false;

	const methodTone = (tag: { name: string; value: string }): { pill: string; code: string; value: string } => {
		if (tag.name.toLowerCase() !== 'method') {
			return {
				pill: 'border-zinc-200 bg-zinc-50 text-zinc-950',
				code: 'border-cyan-300 bg-cyan-100 text-cyan-800',
				value: 'text-zinc-950'
			};
		}

		switch (tag.value.trim().toUpperCase()) {
			case 'POST':
				return {
					pill: 'border-blue-300 bg-blue-50 text-blue-900',
					code: 'border-blue-300 bg-blue-100 text-blue-800',
					value: 'text-blue-900 font-semibold'
				};
			case 'PUT':
			case 'PATCH':
				return {
					pill: 'border-amber-300 bg-amber-50 text-amber-900',
					code: 'border-amber-300 bg-amber-100 text-amber-800',
					value: 'text-amber-900 font-semibold'
				};
			case 'DELETE':
				return {
					pill: 'border-rose-300 bg-rose-50 text-rose-900',
					code: 'border-rose-300 bg-rose-100 text-rose-800',
					value: 'text-rose-900 font-semibold'
				};
			case 'GET':
				return {
					pill: 'border-emerald-300 bg-emerald-50 text-emerald-900',
					code: 'border-emerald-300 bg-emerald-100 text-emerald-800',
					value: 'text-emerald-900 font-semibold'
				};
			default:
				return {
					pill: 'border-zinc-200 bg-zinc-50 text-zinc-950',
					code: 'border-cyan-300 bg-cyan-100 text-cyan-800',
					value: 'text-zinc-950'
				};
		}
	};

	const escapeHtml = (value: string): string =>
		value
			.replaceAll('&', '&amp;')
			.replaceAll('<', '&lt;')
			.replaceAll('>', '&gt;')
			.replaceAll('"', '&quot;')
			.replaceAll("'", '&#39;');

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

	const highlightJson = (value: string): string => {
		const parsed = JSON.parse(value) as unknown;
		const pretty = collapseJson ? JSON.stringify(parsed) : JSON.stringify(parsed, null, 2);

		const highlightScalars = (line: string): string =>
			line
				.replace(/&quot;([^&]*)&quot;/g, '<span class="text-emerald-700">&quot;$1&quot;</span>')
				.replace(/\b(true|false|null)\b/g, '<span class="text-violet-700">$1</span>')
				.replace(/-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?/g, '<span class="text-amber-700">$&</span>');

		if (collapseJson) {
			const escaped = escapeHtml(pretty);
			const withKeys = escaped.replace(
				/(&quot;([^&]*)&quot;)(\s*:)/g,
				'<span class="text-blue-700">$1</span>$3'
			);
			return highlightScalars(withKeys);
		}

		return pretty
			.split(String.fromCharCode(10))
			.map((rawLine) => {
				const escapedLine = escapeHtml(rawLine);
				const keyMatch = escapedLine.match(/^(\s*)&quot;([^&]*)&quot;:\s*(.*)$/);
				if (!keyMatch) return highlightScalars(escapedLine);

				const indent = keyMatch[1];
				const key = keyMatch[2];
				const rest = keyMatch[3];
				return (
					indent +
					'<span class="text-blue-700">&quot;' +
					key +
					'&quot;</span>: ' +
					highlightScalars(rest)
				);
			})
			.join('<br />');
	};

	const renderCode = (value: string): string => {
		const content = isJsonBlock(value) ? highlightJson(value) : escapeHtml(value);
		return content.replace(/\n/g, '<br />');
	};

	const isTypeObject = (value: string): boolean => {
		const trimmed = value.trim();
		return trimmed.startsWith('{') && trimmed.endsWith('}');
	};

	const formatTypeObject = (value: string, collapsed: boolean): string => {
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

			if (collapsed) {
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

	const highlightTypeObject = (value: string): string => {
		const escaped = escapeHtml(value);
		const withKeys = escaped.replace(
			/(^|[,{]\s*)([A-Za-z_][A-Za-z0-9_]*)(\?)?\s*:/g,
			'$1<span class="text-blue-700">$2</span><span class="text-rose-700">$3</span>:'
		);
		const withTypes = withKeys.replace(
			/\b(string|number|boolean|object|unknown|any|never|void|null|undefined|Date|Record|Array)\b/g,
			'<span class="text-emerald-700">$1</span>'
		);
		const withPipes = withTypes.replace(/\|/g, '<span class="text-violet-700">|</span>');
		const withPunctuation = withPipes.replace(/([{}()[\],:])/g, '<span class="text-zinc-500">$1</span>');
		return withPunctuation.replace(/\n/g, '<br />');
	};

	const renderResponse = (value: string): string =>
		isTypeObject(value)
			? highlightTypeObject(formatTypeObject(value, collapseJson))
			: escapeHtml(value).replace(/\n/g, '<br />');
</script>

<div class="docs-detail mx-auto max-w-5xl">
	<div class="docs-detail-head border-b border-zinc-300 pb-4">
		<nav class="flex items-center gap-2 text-xs font-semibold tracking-wide uppercase" aria-label="Breadcrumb">
			<a href={resolve('/docs')} class="text-zinc-900 hover:text-cyan-700 docs-detail-link">All docs</a>
			{#each docGroupCrumbs as crumb (`${crumb.path}`)}
				<span class="text-zinc-500">/</span>
				<a href={groupHref(crumb.path)} class="text-zinc-900 hover:text-cyan-700">{crumb.label}</a>
			{/each}
			<span class="text-zinc-500">/</span>
			<span class="text-zinc-700">{data.doc.title}</span>
		</nav>
	</div>

	<article
		class="docs-detail-surface border-x border-b border-zinc-300 bg-white p-6 sm:p-8"
	>
		<div>
			<div class="flex items-start justify-between gap-4">
				<div class="min-w-0 flex-1">
					<h1 class="docs-detail-title text-4xl font-black tracking-tight text-zinc-950">
						{data.doc.title}
					</h1>
					<p class="docs-detail-muted mt-2 text-[11px] text-zinc-700">
						{data.doc.displayPath ?? `${data.doc.filePath}:${data.doc.line}`}
					</p>
					{#if data.doc.description}
						<div class="mt-4 text-sm leading-relaxed text-zinc-950">
							<p>{data.doc.description}</p>
						</div>
					{/if}
				</div>
				{#if methodTag}
					{@const tone = methodTone(methodTag)}
					<div class={`shrink-0 border px-3 py-1 text-xs ${tone.pill}`}>
						<code class={`mr-1 inline-block border px-1.5 py-0.5 font-semibold ${tone.code}`}>@{methodTag.name}</code>
						<span class={tone.value}>{methodTag.value}</span>
					</div>
				{/if}
			</div>

			{#if nonAuthorTags.length > 0}
				<div class="mt-4 flex flex-wrap gap-2">
					{#each nonAuthorTags as tag (`${tag.name}-${tag.value}`)}
						{@const tone = methodTone(tag)}
						<div
							class={`border px-3 py-1 text-xs ${tone.pill}`}
						>
							<code
								class={`mr-1 inline-block border px-1.5 py-0.5 font-semibold ${tone.code}`}
								>@{tag.name}</code
							>
							<span class={tone.value}>{tag.value}</span>
						</div>
					{/each}
				</div>
			{/if}

			{#if data.author}
				<section class="docs-author-panel mt-5 w-full border border-zinc-300 bg-zinc-50 p-2.5 sm:max-w-xs">
				<div class="flex items-center gap-2.5">
					{#if data.author.imageUrl}
						<img
							src={data.author.imageUrl}
							alt={data.author.name}
							class="h-8 w-8 rounded-full border border-zinc-300 object-cover"
						/>
					{/if}
					<div class="min-w-0 flex-1">
						<p
							class="text-[10px] font-semibold tracking-[0.18em] text-zinc-700 uppercase"
						>
							Author
						</p>
						<a href={resolve(`/docs/authors/${data.authorKey ?? data.author.username ?? ''}`)} class="inline-block mt-0.5 text-sm font-bold text-zinc-900 hover:text-cyan-700">
							{data.author.name}
						</a>
						{#if data.author.title}
							<p class="mt-0.5 text-[11px] text-zinc-600">
								{data.author.title}
							</p>
						{/if}
					</div>
				</div>
				</section>
			{/if}
		</div>

		{#if data.doc.signature}
			<pre
				class="docs-detail-code mt-5 overflow-x-auto border border-zinc-300 bg-zinc-100 p-4 text-xs text-zinc-950"><code
					>{data.doc.signature}</code
				></pre>
		{/if}

		{#if data.doc.params.length > 0}
			<section class="docs-detail-section mt-6 border-t border-zinc-200 pt-6">
				<h2
					class="text-[11px] font-bold tracking-[0.16em] text-zinc-900 uppercase"
				>
					Parameters
				</h2>
				<ul class="mt-3 space-y-2">
					{#each data.doc.params as param (`${param.name}-${param.value}`)}
						<li
							class="border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-950"
						>
							<code
								class="mr-2 inline-block border border-cyan-300 bg-cyan-100 px-1.5 py-0.5 font-semibold text-cyan-800"
								>@{param.name}</code
							>
							{param.value}
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if data.doc.examples.length > 0}
			<section class="docs-detail-section mt-8 border-t border-zinc-200 pt-6">
				<h2
					class="text-[11px] font-bold tracking-[0.16em] text-zinc-900 uppercase"
				>
					Examples
				</h2>
				<div class="mt-3 space-y-3">
					{#each data.doc.examples as example (`${example}`)}
						<pre
							class="overflow-x-auto border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-950"><code
								>{@html renderCode(example)}</code
							></pre>
					{/each}
				</div>
			</section>
		{/if}

		{#if data.doc.returns}
			<section class="docs-detail-section mt-8 border-t border-zinc-200 pt-6">
				<h2
					class="text-[11px] font-bold tracking-[0.16em] text-zinc-900 uppercase"
				>
					Returns
				</h2>
				{#if isJsonBlock(data.doc.returns)}
					<pre class="mt-3 overflow-x-auto border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-950"><code>{@html renderCode(data.doc.returns)}</code></pre>
				{:else}
					<p
						class="mt-3 border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-950"
					>
						{data.doc.returns}
					</p>
				{/if}
			</section>
		{/if}

		{#if data.doc.response}
			<section class="docs-detail-section mt-8 border-t border-zinc-200 pt-6">
				<h2
					class="text-[11px] font-bold tracking-[0.16em] text-zinc-900 uppercase"
				>
					Response
				</h2>
				<pre class="mt-3 overflow-x-auto border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-950"><code>{@html renderResponse(data.doc.response)}</code></pre>
			</section>
		{/if}

		<section class="docs-detail-section mt-8 border-t border-zinc-200 pt-5">
			<h2 class="text-[11px] font-bold tracking-[0.16em] text-zinc-900 uppercase">History</h2>
			<p class="mt-2 text-sm text-zinc-800">Last modified: <span class="font-semibold">{formattedLastModified}</span></p>
			{#if data.doc.versionHistory.length > 0}
				<ul class="mt-3 flex flex-wrap gap-2">
					{#each data.doc.versionHistory as version, index (`${version}`)}
						<li>
							<a
								href={resolve(`/docs/${data.doc.slug}/versions/${version}`)}
								class="block border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-900 hover:border-cyan-500 hover:text-cyan-700"
							>
								{version}{index === 0 ? ' (latest)' : ''}
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<div class="docs-detail-section mt-10 grid gap-3 border-t border-zinc-200 pt-5 sm:grid-cols-2">
			{#if prevDoc}
				<a
					href={resolve(`/docs/${prevDoc.slug}`)}
					class="border border-zinc-300 bg-zinc-100 px-4 py-3 text-xs text-zinc-950 hover:border-cyan-500 hover:text-cyan-700"
				>
					<p class="font-semibold tracking-wide uppercase">Previous</p>
					<p class="mt-1 truncate text-sm text-zinc-950">{prevDoc.title}</p>
				</a>
			{/if}
			{#if nextDoc}
				<a
					href={resolve(`/docs/${nextDoc.slug}`)}
					class={`border border-zinc-300 bg-zinc-100 px-4 py-3 text-xs text-zinc-950 hover:border-cyan-500 hover:text-cyan-700 ${prevDoc ? '' : 'sm:col-start-2'}`}
				>
					<p class="font-semibold tracking-wide uppercase">Next</p>
					<p class="mt-1 truncate text-sm text-zinc-950">{nextDoc.title}</p>
				</a>
			{/if}
		</div>
	</article>
</div>
