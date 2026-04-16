import type { PageLoad } from './$types';
import { authors, docs, generatedAt } from './generated';

/** Loads data required by the docs overview page. */
export const load: PageLoad = async () => {
	const sortedAuthors = Object.entries(authors)
		.map(([key, profile]) => ({ key, ...profile }))
		.sort((left, right) => left.name.localeCompare(right.name));

	return {
		docs: [...docs].sort((a, b) => a.title.localeCompare(b.title)),
		authors: sortedAuthors,
		generatedAt
	};
};
