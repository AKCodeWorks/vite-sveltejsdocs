<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const changedAt = $derived(new Date(data.selectedVersion.changedAt).toLocaleString());
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
</script>

<div class="docs-version mx-auto max-w-5xl">
	<div class="flex items-center justify-between border-b border-zinc-300 pb-4">
		<nav class="flex items-center gap-2 text-xs font-semibold tracking-wide uppercase" aria-label="Breadcrumb">
			<a href={resolve('/docs')} class="text-zinc-900 hover:text-cyan-700">All docs</a>
			{#each docGroupCrumbs as crumb (`${crumb.path}`)}
				<span class="text-zinc-500">/</span>
				<a href={groupHref(crumb.path)} class="text-zinc-900 hover:text-cyan-700">{crumb.label}</a>
			{/each}
			<span class="text-zinc-500">/</span>
			<a href={resolve(`/docs/${data.doc.slug}`)} class="text-zinc-900 hover:text-cyan-700">{data.doc.title}</a>
			<span class="text-zinc-500">/</span>
			<span class="text-zinc-700">{data.selectedVersion.version}</span>
		</nav>
		<p class="text-[11px] text-zinc-700">Version history</p>
	</div>

	<article class="mt-4 border border-zinc-300 bg-white p-6 sm:p-8">
		<p class="text-[10px] font-semibold tracking-[0.2em] text-cyan-700 uppercase">What changed</p>
		<h1 class="mt-2 text-3xl font-black tracking-tight text-zinc-950">{data.doc.title} - {data.selectedVersion.version}</h1>
		<p class="mt-2 text-sm text-zinc-800">Captured: <span class="font-semibold">{changedAt}</span></p>

		{#if data.priorVersion}
			<p class="mt-2 text-xs text-zinc-700">Compared to previous version <span class="font-semibold">{data.priorVersion.version}</span></p>
		{:else}
			<p class="mt-2 text-xs text-zinc-700">This is the first recorded version for this doc entry.</p>
		{/if}

		{#if !data.hasDiff}
			<div class="mt-6 border border-dashed border-zinc-300 bg-zinc-50 px-4 py-4 text-sm text-zinc-800">
				No changes detected
			</div>
		{:else}
			<div class="mt-6 overflow-x-auto border border-zinc-300 bg-zinc-950 text-zinc-100">
				<pre class="min-w-full px-0 py-0 text-xs"><code>{#each data.diffLines as line, idx (`${idx}-${line.kind}`)}<span class={line.kind === 'add' ? 'block bg-emerald-900/35 text-emerald-200' : line.kind === 'remove' ? 'block bg-rose-900/35 text-rose-200' : 'block text-zinc-300'}>{line.kind === 'add' ? '+' : line.kind === 'remove' ? '-' : ' '}{line.text}</span>{/each}</code></pre>
			</div>
		{/if}
	</article>
</div>
