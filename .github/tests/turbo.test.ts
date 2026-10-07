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
	dependsOn?: string[];
	outputs?: string[];
}
const turbo: { globalDependencies?: string[]; tasks: Record<string, Task> } = JSON.parse(
	readFileSync(join(REPO, 'plugins/turbo.json'), 'utf8')
);

describe('plugins/turbo.json', () => {
	test('cached tasks keep turbo default inputs', () => {
		const narrowed = Object.entries(turbo.tasks)
			.filter(([_name, task]) => task.cache !== false && task.inputs !== undefined && !task.inputs.includes('$TURBO_DEFAULT$'))
			.map(([name, task]) => `${name}: ${JSON.stringify(task.inputs)}`);
		assert.deepEqual(narrowed, [], 'add "$TURBO_DEFAULT$" to inputs, or drop them');
	});

	// Jest resolves workspace packages (e.g. @shared/core) to their source, so a
	// test's hash must include its dependencies' files. `^transit` does that
	// without running anything: transit has no script in any package.
	test('test tasks are invalidated by changes in workspace dependencies', () => {
		for (const name of ['test', 'test:ci']) {
			assert.ok(turbo.tasks[name]?.dependsOn?.includes('^transit'), `${name} must dependsOn "^transit"`);
		}
		assert.deepEqual(turbo.tasks.transit?.dependsOn, ['^transit']);
	});

	// A cache hit restores only declared outputs. build-types writes the
	// declarations that a dependent package's type-check reads, so with no
	// outputs a cached build-types would leave them missing (TS6305).
	test('build-types declares the declarations it writes as outputs', () => {
		assert.ok(turbo.tasks['build-types']?.outputs?.includes('.cache/tsbuild/**'));
	});

	test('shared build and lint config, and the Node version, invalidate every package', () => {
		for (const dep of ['.shared/**', 'biome.json', '.nvmrc']) {
			assert.ok(turbo.globalDependencies?.includes(dep), `globalDependencies is missing ${dep}`);
		}
	});
});
