import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { docs, history } from '../../../generated';

type DiffLine = {
	kind: 'context' | 'add' | 'remove';
	text: string;
};

const buildUnifiedDiff = (beforeText: string, afterText: string): DiffLine[] => {
	const before = beforeText.split(/\r?\n/);
	const after = afterText.split(/\r?\n/);
	const dp = Array.from({ length: before.length + 1 }, () => Array(after.length + 1).fill(0));

	for (let i = before.length - 1; i >= 0; i -= 1) {
		for (let j = after.length - 1; j >= 0; j -= 1) {
			dp[i][j] = before[i] === after[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
		}
	}

	const result: DiffLine[] = [];
	let i = 0;
	let j = 0;

	while (i < before.length && j < after.length) {
		if (before[i] === after[j]) {
			result.push({ kind: 'context', text: before[i] });
			i += 1;
			j += 1;
			continue;
		}

		if (dp[i + 1][j] >= dp[i][j + 1]) {
			result.push({ kind: 'remove', text: before[i] });
			i += 1;
		} else {
			result.push({ kind: 'add', text: after[j] });
			j += 1;
		}
	}

	while (i < before.length) {
		result.push({ kind: 'remove', text: before[i] });
		i += 1;
	}

	while (j < after.length) {
		result.push({ kind: 'add', text: after[j] });
		j += 1;
	}

	return result;
};

/** Loads selected version data and computes field-level change details against the prior version. */
export const load: PageLoad = async ({ params }) => {
	const doc = docs.find((entry) => entry.slug === params.slug);
	if (!doc) {
		throw error(404, 'Documentation entry not found');
	}

	const versions = history[doc.id] ?? [];
	const index = versions.findIndex((entry) => entry.version === params.version);
	if (index < 0) {
		throw error(404, 'Version not found for this documentation entry');
	}

	const selectedVersion = versions[index];
	const priorVersion = index + 1 < versions.length ? versions[index + 1] : null;

	const beforeRaw = priorVersion?.snapshot.jsdocRaw ?? '';
	const afterRaw = selectedVersion.snapshot.jsdocRaw ?? '';
	const diffLines = buildUnifiedDiff(beforeRaw, afterRaw);
	const hasDiff = diffLines.some((line) => line.kind !== 'context');

	return {
		doc,
		selectedVersion,
		priorVersion,
		diffLines,
		hasDiff
	};
};
