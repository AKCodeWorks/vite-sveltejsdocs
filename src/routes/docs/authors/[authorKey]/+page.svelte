<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const phoneEntries = $derived(data.author.phone ? Object.entries(data.author.phone).filter(([, value]) => Boolean(value)) : []);
	const authorImageSrc = $derived(
		data.author.imageUrl
			? /^(https?:\/\/|\/)/.test(data.author.imageUrl)
				? data.author.imageUrl
				: '/' + data.author.imageUrl.replace(/^\.\/+/, '').replace(/^\/+/, '')
			: null
	);
</script>

<div class="docs-author-profile mx-auto max-w-4xl">
	<div class="flex items-center justify-between border-b border-zinc-300 pb-4">
		<a href={resolve('/docs')} class="text-xs font-semibold tracking-wide text-zinc-900 uppercase hover:text-cyan-700">All docs</a>
		<p class="text-[11px] text-zinc-700">Author profile</p>
	</div>

	<article class="mt-4 border border-zinc-300 bg-white p-6 sm:p-8">
		<div class="flex items-start gap-4">
			{#if authorImageSrc}
				<img src={authorImageSrc} alt={data.author.name} class="h-16 w-16 rounded-full border border-zinc-300 object-cover" />
			{/if}
			<div class="min-w-0 flex-1">
				<h1 class="text-3xl font-black tracking-tight text-zinc-950">{data.author.name}</h1>
				{#if data.author.title}
					<p class="mt-1 text-sm text-zinc-800">{data.author.title}</p>
				{/if}
				<p class="mt-1 text-xs text-zinc-700">@{data.author.username ?? data.authorKey}</p>
			</div>
		</div>

		{#if data.author.bio}
			<section class="mt-6 border-t border-zinc-200 pt-5">
				<h2 class="text-[11px] font-bold tracking-[0.16em] text-zinc-900 uppercase">Bio</h2>
				<p class="mt-2 text-sm leading-relaxed text-zinc-900">{data.author.bio}</p>
			</section>
		{/if}

		{#if data.author.email || data.author.address || phoneEntries.length > 0 || data.author.links}
			<section class="mt-6 border-t border-zinc-200 pt-5">
				<h2 class="text-[11px] font-bold tracking-[0.16em] text-zinc-900 uppercase">Contact</h2>

				{#if data.author.email}
					<p class="mt-2 text-sm text-zinc-900">Email: <a href={`mailto:${data.author.email}`} class="font-semibold hover:text-cyan-700">{data.author.email}</a></p>
				{/if}

				{#if data.author.address}
					<p class="mt-2 text-sm text-zinc-900">Address: {data.author.address}</p>
				{/if}

				{#if phoneEntries.length > 0}
					<ul class="mt-3 space-y-1">
						{#each phoneEntries as [label, number] (`${label}-${number}`)}
							<li class="text-sm text-zinc-900"><span class="font-semibold capitalize">{label}:</span> {number}</li>
						{/each}
					</ul>
				{/if}

				{#if data.author.links}
					<div class="mt-4 flex flex-wrap gap-2">
						{#each Object.entries(data.author.links) as [label, href] (`${label}-${href}`)}
							<a
								href={href}
								target="_blank"
								rel="noopener noreferrer"
								class="border border-zinc-300 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-zinc-900 uppercase hover:border-cyan-500 hover:text-cyan-700"
							>
								{label}
							</a>
						{/each}
					</div>
				{/if}
			</section>
		{/if}
	</article>
</div>

