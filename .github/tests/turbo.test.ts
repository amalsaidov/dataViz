// plugins/turbo.json: root CI restores turbo's cache between runs, which is
// only correct while each cached task hashes every file it reads. Narrowing a
// task's inputs (e.g. to src/**) would let a jest.config.js or tsconfig.json
// change replay a stale cached pass.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { REPO } from './helpers.ts';

interface Task {
	cache?: boolean;
	inputs?: string[];
}
const turbo: { globalDependencies?: string[]; tasks: Record<string, Task> } = JSON.parse(
	readFileSync(join(REPO, 'plugins/turbo.json'), 'utf8')
);

describe('plugins/turbo.json', () => {
	test('cached tasks keep turbo default inputs', () => {
		const narrowed = Object.entries(turbo.tasks)
			.filter(([, t]) => t.cache !== false && t.inputs !== undefined && !t.inputs.includes('$TURBO_DEFAULT$'))
			.map(([name, t]) => `${name}: ${JSON.stringify(t.inputs)}`);
		assert.deepEqual(narrowed, [], 'add "$TURBO_DEFAULT$" to inputs, or drop them');
	});

	test('shared build and lint config invalidates every package', () => {
		for (const dep of ['.shared/**', 'biome.json']) {
			assert.ok(turbo.globalDependencies?.includes(dep), `globalDependencies is missing ${dep}`);
		}
	});
});
