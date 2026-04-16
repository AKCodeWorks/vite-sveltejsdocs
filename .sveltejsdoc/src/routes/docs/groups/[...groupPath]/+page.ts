import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { docs } from '../../generated';

const decodeGroupParam = (value: string): string => {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
};

const parseGroupSegments = (value: string): string[] =>
	value
		.split('/')
		.map((segment) => decodeGroupParam(segment).trim())
		.filter(Boolean);

/** Loads entries for a single docs group and preserves title ordering. */
export const load: PageLoad = async ({ params }) => {
	const groupPathRaw = params.groupPath ?? '';
	const segments = parseGroupSegments(groupPathRaw);
	const groupName = segments.join('/');

	if (!groupName) {
		throw error(404, 'Documentation group not found');
	}

	const entries = docs
		.filter((doc) => (doc.group || 'Ungrouped') === groupName)
		.sort((a, b) => a.title.localeCompare(b.title));

	const childGroupMap = new Map<string, { path: string; name: string; docCount: number }>();
	const prefix = groupName + '/';
	for (const doc of docs) {
		const group = doc.group || 'Ungrouped';
		if (!group.startsWith(prefix)) continue;
		const remainder = group.slice(prefix.length);
		const [nextSegment] = remainder.split('/');
		if (!nextSegment) continue;
		const childPath = `${groupName}/${nextSegment}`;
		const existing = childGroupMap.get(childPath);
		if (existing) {
			existing.docCount += 1;
			continue;
		}
		childGroupMap.set(childPath, {
			path: childPath,
			name: nextSegment,
			docCount: 1
		});
	}

	const childGroups = [...childGroupMap.values()].sort((a, b) => a.path.localeCompare(b.path));

	if (entries.length === 0 && childGroups.length === 0) {
		throw error(404, 'Documentation group not found');
	}

	return {
		groupName,
		segments,
		docs: entries,
		childGroups
	};
};
