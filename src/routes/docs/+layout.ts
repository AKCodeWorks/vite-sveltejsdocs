import { error } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';
import { docs, generatedAt } from './generated';
import { docsEnabled } from './settings';

/**
 * Loads shared docs data for all `/docs` routes.
 * Entries are ordered by case-sensitive group and then by case-sensitive title.
 */
export const load: LayoutLoad = async () => {
	if (!docsEnabled) {
		throw error(404, 'Not found');
	}

	const compareAlphabetical = (left: string, right: string): number => {
		const folded = left.localeCompare(right, undefined, { sensitivity: 'base' });
		if (folded !== 0) return folded;
		return left.localeCompare(right);
	};

	const sortedDocs = [...docs].sort((a, b) => {
		const groupOrder = compareAlphabetical(a.group || '', b.group || '');
		if (groupOrder !== 0) return groupOrder;
		return compareAlphabetical(a.title, b.title);
	});

	return {
		docs: sortedDocs,
		generatedAt
	};
};
