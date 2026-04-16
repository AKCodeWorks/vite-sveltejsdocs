import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { authors, docs, type GeneratedAuthorProfile } from '../generated';

const normalizeAuthorKey = (value: string): string => value.trim().replace(/^@/, '').toLowerCase();

const candidateKeysFromTag = (raw: string): string[] => {
	const cleaned = raw.trim();
	if (!cleaned) return [];

	const parts = cleaned
		.split(/[\s,|]+/)
		.map((part) => normalizeAuthorKey(part))
		.filter(Boolean);

	const full = normalizeAuthorKey(cleaned);
	return [...new Set([full, ...parts])];
};

const resolveAuthor = (tagValue: string): { key: string; profile: GeneratedAuthorProfile } | null => {
	for (const key of candidateKeysFromTag(tagValue)) {
		const profile = authors[key];
		if (profile) return { key, profile };
	}

	return null;
};

/** Resolves a single docs entry by slug for the detail page. */
export const load: PageLoad = async ({ params }) => {
	const doc = docs.find((entry) => entry.slug === params.slug);
	if (!doc) {
		throw error(404, 'Documentation entry not found');
	}

	const authorTag = doc.tags.find((tag) => tag.name.toLowerCase() === 'author');
	const resolvedAuthor = authorTag ? resolveAuthor(authorTag.value) : null;

	return {
		doc,
		author: resolvedAuthor?.profile ?? null,
		authorKey: resolvedAuthor?.key ?? null
	};
};
