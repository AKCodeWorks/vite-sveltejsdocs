<script lang="ts">
	import { page } from '$app/state';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();
	let searchQuery = $state('');
	const navbarCollapsedByDefault = true;
	let toggledGroupPaths = $state(new Set<string>());
	const docsTitle = "SvelteJSDoc";
	const docsLogo = null;
	const logoSrc = docsLogo
		? /^(https?:\/\/|\/)/.test(docsLogo)
			? docsLogo
			: "/" + docsLogo.replace(/^\.\/+/, '').replace(/^\/+/, '')
		: null;

	const normalizeText = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, '');

	const fuzzyScore = (query: string, target: string): number => {
		const q = normalizeText(query);
		const t = normalizeText(target);
		if (!q.length) return 0;
		if (!t.length) return -1;

		const directIndex = t.indexOf(q);
		if (directIndex >= 0) {
			return 1200 - directIndex * 2 - (t.length - q.length);
		}

		let qIndex = 0;
		let lastMatch = -1;
		let gapPenalty = 0;
		let streak = 0;
		let bestStreak = 0;

		for (let i = 0; i < t.length && qIndex < q.length; i += 1) {
			if (t[i] !== q[qIndex]) continue;

			if (lastMatch >= 0) {
				gapPenalty += Math.max(0, i - lastMatch - 1);
			}

			streak = i === lastMatch + 1 ? streak + 1 : 1;
			bestStreak = Math.max(bestStreak, streak);
			lastMatch = i;
			qIndex += 1;
		}

		if (qIndex !== q.length) return -1;

		return 700 - gapPenalty * 3 + bestStreak * 12 - (t.length - q.length);
	};

	const docScore = (query: string, doc: LayoutData['docs'][number]): number => {
		const fields = [doc.title, doc.displayPath, doc.group, doc.summary, doc.filePath];
		let best = -1;
		for (const field of fields) {
			best = Math.max(best, fuzzyScore(query, field));
		}
		return best;
	};

	const groupToSegments = (group: string): string[] =>
		group.split('/').map((segment) => segment.trim()).filter(Boolean);

	const expandGroupPaths = (group: string): string[] => {
		const segments = groupToSegments(group);
		if (segments.length === 0) return ['Ungrouped'];

		const paths: string[] = [];
		for (let i = 0; i < segments.length; i += 1) {
			paths.push(segments.slice(0, i + 1).join('/'));
		}
		return paths;
	};

	const groupHref = (groupPath: string): string =>
		groupPath === 'Ungrouped'
			? '/docs/groups/Ungrouped'
			: '/docs/groups/' + groupToSegments(groupPath).map((segment) => encodeURIComponent(segment)).join('/');

	const compareAlphabetical = (left: string, right: string): number => {
		const folded = left.localeCompare(right, undefined, { sensitivity: 'base' });
		if (folded !== 0) return folded;
		return left.localeCompare(right);
	};

	const toggleGroup = (groupPath: string): void => {
		if (searchQuery.trim().length > 0) return;
		const next = new Set(toggledGroupPaths);
		if (next.has(groupPath)) {
			next.delete(groupPath);
		} else {
			next.add(groupPath);
		}
		toggledGroupPaths = next;
	};

	const isGroupCollapsed = (groupPath: string): boolean =>
		searchQuery.trim().length === 0 && (navbarCollapsedByDefault ? !toggledGroupPaths.has(groupPath) : toggledGroupPaths.has(groupPath));

	const groupedDocs = $derived.by(() => {
		const query = searchQuery.trim();
		const groups = new Map<string, Array<{ doc: LayoutData['docs'][number]; score: number }>>();
		const allGroupPaths = new Set<string>();

		for (const doc of data.docs) {
			const score = query ? docScore(query, doc) : 0;
			if (query && score < 0) continue;

			const key = doc.group || 'Ungrouped';
			for (const path of expandGroupPaths(key)) {
				allGroupPaths.add(path);
			}
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key)?.push({ doc, score });
		}

		for (const docsInGroup of groups.values()) {
			docsInGroup.sort((left, right) => {
				if (query) {
					const scoreDelta = right.score - left.score;
					if (scoreDelta !== 0) return scoreDelta;
				}

				return compareAlphabetical(left.doc.title, right.doc.title);
			});
		}

		return [...allGroupPaths]
			.sort((a, b) => {
				return compareAlphabetical(a, b);
			})
			.map((groupName) => {
				const docsInGroup = groups.get(groupName) ?? [];
				const segments = groupToSegments(groupName);
				const ancestors = segments.slice(0, -1).map((_, index) => segments.slice(0, index + 1).join('/'));
				return {
				groupName,
				groupPath: groupName,
				depth: Math.max(0, segments.length - 1),
				label: segments.length > 0 ? segments[segments.length - 1] : groupName,
				ancestors,
				docs: docsInGroup.map((entry) => entry.doc)
				};
			});
	});
</script>

	<section class="min-h-screen bg-zinc-50 text-zinc-950 lg:h-screen lg:overflow-hidden">

	<div class="mx-auto grid max-w-7xl grid-cols-1 gap-0 lg:h-full lg:grid-cols-[17rem_1fr]">
		<aside
			class="border-zinc-300 border-b bg-zinc-950 text-zinc-100 lg:flex lg:h-screen lg:flex-col lg:border-r lg:border-b-0"
		>
			<div class="border-b border-zinc-800 px-5 py-5">
				<div class="flex items-center gap-3">
					{#if logoSrc}
						<img
							src={logoSrc}
							alt={docsTitle}
							class="h-8 w-8 shrink-0 rounded border border-zinc-700 bg-zinc-900/70 object-contain p-1"
						/>
					{/if}
					<h1 class="text-xl font-black tracking-tight">{docsTitle}</h1>
				</div>
			</div>

			<div class="border-b border-zinc-800 px-5 py-4">
				<input
					id="docs-search"
					type="search"
					bind:value={searchQuery}
					placeholder="Search docs..."
					class="mt-2 w-full border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-cyan-400 focus:outline-none"
				/>
			</div>

			<nav
				class="max-h-[42vh] overflow-y-auto lg:min-h-0 lg:flex-1 lg:max-h-none"
				aria-label="Documentation navigation"
			>
				<ul>
					<li>
						<a
							href="/docs"
							class={`block border-b border-zinc-800 px-5 py-3 text-xs font-semibold tracking-wide uppercase transition ${page.url.pathname === '/docs' ? 'bg-zinc-800 text-cyan-200' : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'}`}
						>
							Home
						</a>
					</li>
					{#if groupedDocs.length === 0}
						<li class="border-b border-zinc-800 px-5 py-4 text-xs text-zinc-400">
							No matches for "{searchQuery.trim()}"
						</li>
					{/if}
					{#each groupedDocs as groupEntry (`${groupEntry.groupPath}`)}
						{#if !groupEntry.ancestors.some((ancestor) => isGroupCollapsed(ancestor))}
							<li class="border-b border-zinc-800">
								<div class="flex items-center bg-zinc-900" style={`padding-left: ${1.25 + groupEntry.depth * 0.9}rem; padding-right: 0.5rem;`}>
									<button
										type="button"
										class="mr-1 cursor-pointer p-1 text-zinc-500 hover:text-cyan-300"
										onclick={() => toggleGroup(groupEntry.groupPath)}
										aria-label={`Toggle ${groupEntry.label}`}
									>
										{isGroupCollapsed(groupEntry.groupPath) ? '▸' : '▾'}
									</button>
									<a
										href={groupHref(groupEntry.groupPath)}
										class="flex-1 py-2 text-[10px] font-semibold tracking-[0.18em] text-zinc-400 uppercase hover:text-cyan-200"
									>
										{groupEntry.label}
									</a>
								</div>
								{#if !isGroupCollapsed(groupEntry.groupPath)}
									<ul>
										{#each groupEntry.docs as doc (`${doc.id}`)}
											<li>
												<a
													href={`/docs/${doc.slug}`}
													class={`block border-t border-zinc-800 py-3 text-xs transition ${page.url.pathname === `/docs/${doc.slug}` ? 'bg-zinc-800 text-cyan-200' : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'}`}
													style={`padding-left: ${1.7 + groupEntry.depth * 0.9}rem; padding-right: 1rem;`}
												>
													<p class="font-semibold tracking-wide uppercase">{doc.title}</p>
													<p class="mt-1 truncate text-[10px] text-zinc-500">{doc.displayPath}</p>
												</a>
											</li>
										{/each}
									</ul>
								{/if}
							</li>
						{/if}
					{/each}
				</ul>
			</nav>
		</aside>

		<main class="min-h-screen border-zinc-300 border-l bg-white px-6 py-8 text-zinc-950 sm:px-10 lg:h-screen lg:overflow-y-auto">
			{@render children()}
		</main>
	</div>
</section>
