import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { authors } from '../../generated';

/** Loads a configured author profile by key for detail rendering. */
export const load: PageLoad = async ({ params }) => {
	const requestedKey = params.authorKey;
	const resolvedKey =
		authors[requestedKey]
			? requestedKey
			: Object.keys(authors).find((key) => key.toLowerCase() === requestedKey.toLowerCase());

	const author = resolvedKey ? authors[resolvedKey] : undefined;
	if (!author) {
		throw error(404, 'Author not found');
	}

	return {
		authorKey: resolvedKey,
		author
	};
};
