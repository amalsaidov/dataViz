// scripts/find-module.sh: locating module.ts(x) next to a target's plugin.json.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, test, type TestContext } from 'node:test';
import { SCRIPTS, bash, readOutputs, tempDir, writeText } from './helpers.ts';

const SCRIPT = join(SCRIPTS, 'find-module.sh');

function findModule(t: TestContext, files: string[], pluginJson = 'src/plugin.json') {
	const cwd = tempDir(t);
	for (const file of files) {
		writeText(join(cwd, 'pkg', file), '');
	}
	const output = join(cwd, 'output');
	writeText(output, '');
	const script = bash(SCRIPT, [], { cwd, env: { DIR: 'pkg', PLUGIN_JSON: pluginJson, GITHUB_OUTPUT: output } });
	return { ...script, path: readOutputs(output).path };
}

describe('scripts/find-module.sh', () => {
	// `files` exist in the package; `path` is the module find-module.sh should report.
	const found: { name: string; files: string[]; pluginJson: string; path: string }[] = [
		{
			name: 'finds module.ts next to plugin.json',
			files: ['src/plugin.json', 'src/module.ts'],
			pluginJson: 'src/plugin.json',
			path: './pkg/src/module.ts',
		},
		{
			name: 'finds module.tsx for a nested target',
			files: ['src/modules/relations/plugin.json', 'src/modules/relations/module.tsx'],
			pluginJson: 'src/modules/relations/plugin.json',
			path: './pkg/src/modules/relations/module.tsx',
		},
		{
			name: 'prefers module.ts when both exist',
			files: ['src/module.ts', 'src/module.tsx'],
			pluginJson: 'src/plugin.json',
			path: './pkg/src/module.ts',
		},
	];

	for (const { name, files, pluginJson, path } of found) {
		test(name, (t) => {
			const lookup = findModule(t, files, pluginJson);
			assert.equal(lookup.status, 0, lookup.stderr);
			assert.equal(lookup.path, path);
		});
	}

	test('fails with an annotation when there is no module', (t) => {
		const lookup = findModule(t, ['src/plugin.json']);
		assert.equal(lookup.status, 1);
		assert.match(lookup.stdout, /^::error file=pkg\/src\/plugin.json::no module.ts or module.tsx/m);
		assert.equal(lookup.path, undefined);
	});
});
