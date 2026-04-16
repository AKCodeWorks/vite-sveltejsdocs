<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const homeTagline = "DOCUMENTATION";
	const homeHeading = "Documentation Home";
	const homeDescription = "JSDoc auto generated documentation for developers.";
	const normalizeAssetSrc = (value?: string): string | null =>
		value
			? /^(https?:\/\/|\/)/.test(value)
				? value
				: '/' + value.replace(/^\.\/+/, '').replace(/^\/+/, '')
			: null;

	const groupHref = (groupName: string): string => {
		const parts = groupName.split('/').map((segment) => segment.trim()).filter(Boolean);
		if (parts.length === 0) return '/docs/groups/Ungrouped';
		return '/docs/groups/' + parts.map((segment) => encodeURIComponent(segment)).join('/');
	};

	const groupedDocs = $derived.by(() => {
		const groups = new Map<string, PageData['docs']>();
		for (const doc of data.docs) {
			const key = doc.group || 'Ungrouped';
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key)?.push(doc);
		}

		for (const docsInGroup of groups.values()) {
			docsInGroup.sort((left, right) => {
				if (left.title === right.title) return 0;
				return left.title < right.title ? -1 : 1;
			});
		}

		return [...groups.entries()].sort(([a], [b]) => {
			if (a === b) return 0;
			return a < b ? -1 : 1;
		});
	});
</script>

<div class="docs-home mx-auto max-w-5xl">
	<header class="border-b border-zinc-300 pb-6 docs-home-header">
		<p class="text-[10px] font-semibold tracking-[0.24em] text-cyan-700 uppercase">
			{homeTagline}
		</p>
		<h2
			class="docs-home-title mt-2 text-4xl leading-tight font-black tracking-tight text-zinc-900"
		>
			{homeHeading}
		</h2>
		<p class="docs-home-summary mt-3 max-w-3xl text-sm text-zinc-900">
			{homeDescription}
		</p>
	</header>

	{#if data.authors.length > 0}
		<section class="mt-6 docs-home-authors">
			<div class="mb-2 flex items-center justify-between">
				<h3 class="text-[11px] font-bold tracking-[0.16em] text-zinc-900 uppercase">Contributors</h3>
				<p class="text-xs text-zinc-700">{data.authors.length} listed</p>
			</div>
			<ul class="grid gap-2 sm:grid-cols-2">
				{#each data.authors as author (`${author.key}`)}
					{@const authorImageSrc = normalizeAssetSrc(author.imageUrl)}
					<li class="docs-author-chip border border-zinc-300 bg-zinc-50 px-3 py-2">
						<a href={`/docs/authors/${author.key}`} class="block hover:text-cyan-700">
						<div class="flex items-center gap-2.5">
							{#if authorImageSrc}
								<img
									src={authorImageSrc}
									alt={author.name}
									class="h-8 w-8 rounded-full border border-zinc-300 object-cover"
								/>
							{/if}
							<div class="min-w-0">
								<p class="truncate text-sm font-semibold text-zinc-900">{author.name}</p>
								{#if author.title}
									<p class="truncate text-xs text-zinc-700">{author.title}</p>
								{/if}
							</div>
						</div>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if data.docs.length === 0}
		<div
			class="mt-8 border border-dashed border-zinc-400 bg-white p-8 docs-home-empty"
		>
			<h3 class="text-lg font-bold text-zinc-900">No entries found</h3>
			<p class="mt-2 text-sm text-zinc-800">
				Add an eligible JSDoc block and rebuild or refresh dev mode.
			</p>
		</div>
	{:else}
		{#each groupedDocs as [groupName, docsInGroup] (`${groupName}`)}
			<section
				class="docs-home-section mt-8 overflow-hidden border border-zinc-300 bg-white"
			>
				<div
					class="border-b border-zinc-300 bg-zinc-900 px-4 py-2 text-[10px] font-semibold tracking-[0.2em] text-zinc-300 uppercase"
				>
					<a href={groupHref(groupName)} class="hover:text-cyan-200">{groupName}</a>
				</div>
				<div
					class="docs-home-columns grid grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_auto] border-b border-zinc-300 bg-zinc-100 px-4 py-3 text-[10px] font-semibold tracking-[0.18em] text-zinc-700 uppercase"
				>
					<span>Doc</span>
					<span>Source</span>
					<span>Params</span>
				</div>
				<ul>
					{#each docsInGroup as doc, index (`${doc.id}`)}
						<li
							class={`grid grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_auto] items-start gap-3 px-4 py-4 ${index < docsInGroup.length - 1 ? 'border-b border-zinc-200' : ''}`}
						>
							<div class="min-w-0">
								<a
									href={`/docs/${doc.slug}`}
									class="font-semibold text-zinc-900 hover:text-cyan-700"
									>{doc.title}</a
								>
								<p class="mt-1 text-sm text-zinc-900">{doc.summary}</p>
							</div>
							<p class="pt-0.5 text-xs text-zinc-800">
								{doc.displayPath ?? `${doc.filePath}:${doc.line}`}
							</p>
							<p class="pt-0.5 text-xs font-semibold text-zinc-800">
								{doc.params.length}
							</p>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	{/if}
</div>

