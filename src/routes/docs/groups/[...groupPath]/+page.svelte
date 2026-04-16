<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const groupCrumbs = $derived(
		data.segments.map((segment, index) => ({
			label: segment,
			path: data.segments.slice(0, index + 1).join('/')
		}))
	);

	const groupHref = (groupPath: string): string =>
		'/docs/groups/' +
		groupPath
			.split('/')
			.map((segment) => encodeURIComponent(segment))
			.join('/');
</script>

<div class="docs-group mx-auto max-w-5xl">
	<div class="border-b border-zinc-300 pb-4">
		<nav class="flex items-center gap-2 text-xs font-semibold tracking-wide uppercase" aria-label="Breadcrumb">
			<a href={resolve('/docs')} class="text-zinc-900 hover:text-cyan-700">All docs</a>
			{#each groupCrumbs as crumb, index (`${crumb.path}`)}
				<span class="text-zinc-500">/</span>
				{#if index < groupCrumbs.length - 1}
					<a href={groupHref(crumb.path)} class="text-zinc-900 hover:text-cyan-700">{crumb.label}</a>
				{:else}
					<span class="text-zinc-700">{crumb.label}</span>
				{/if}
			{/each}
		</nav>
	</div>

	<article class="mt-4 border border-zinc-300 bg-white p-6 sm:p-8">
		<p class="text-[10px] font-semibold tracking-[0.2em] text-cyan-700 uppercase">Group</p>
		<h1 class="mt-2 text-3xl font-black tracking-tight text-zinc-950">{data.groupName}</h1>
		<p class="mt-2 text-sm text-zinc-800">{data.docs.length} {data.docs.length === 1 ? 'entry' : 'entries'} in this group</p>

		{#if data.childGroups.length > 0}
			<section class="mt-6 border border-zinc-200 bg-zinc-50 p-4">
				<p class="text-[10px] font-semibold tracking-[0.18em] text-zinc-700 uppercase">Subgroups</p>
				<ul class="mt-3 space-y-2">
					{#each data.childGroups as child (`${child.path}`)}
						<li class="flex items-center justify-between gap-3 border border-zinc-200 bg-white px-3 py-2">
							<a href={groupHref(child.path)} class="text-sm font-semibold text-zinc-900 hover:text-cyan-700">{child.name}</a>
							<span class="text-xs text-zinc-700">{child.docCount} {child.docCount === 1 ? 'entry' : 'entries'}</span>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if data.docs.length > 0}
			<ul class="mt-6 space-y-3">
				{#each data.docs as doc (`${doc.id}`)}
					<li class="border border-zinc-200 bg-zinc-50 px-4 py-3">
						<a href={resolve(`/docs/${doc.slug}`)} class="text-sm font-semibold text-zinc-900 hover:text-cyan-700">{doc.title}</a>
						<p class="mt-1 text-xs text-zinc-700">{doc.displayPath}</p>
						{#if doc.summary}
							<p class="mt-2 text-sm text-zinc-900">{doc.summary}</p>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</article>
</div>
