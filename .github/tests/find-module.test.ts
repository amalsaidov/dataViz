// scripts/find-module.sh: locating module.ts(x) next to a target's plugin.json.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { SCRIPTS, bash, readOutputs, tempDir, writeText } from './helpers.ts';

const SCRIPT = join(SCRIPTS, 'find-module.sh');

function find(t: TestContext, files: string[], pluginJson = 'src/plugin.json') {
	const cwd = tempDir(t);
	for (const f of files) {
		writeText(join(cwd, 'pkg', f), '');
	}
	const output = join(cwd, 'output');
	writeText(output, '');
	const r = bash(SCRIPT, [], { cwd, env: { DIR: 'pkg', PLUGIN_JSON: pluginJson, GITHUB_OUTPUT: output } });
	return { ...r, path: readOutputs(output).path };
}

// [case, files in the package, target pluginJson, expected path output]
const found: [string, string[], string, string][] = [
	['finds module.ts next to plugin.json', ['src/plugin.json', 'src/module.ts'], 'src/plugin.json', './pkg/src/module.ts'],
	[
		'finds module.tsx for a nested target',
		['src/modules/relations/plugin.json', 'src/modules/relations/module.tsx'],
		'src/modules/relations/plugin.json',
		'./pkg/src/modules/relations/module.tsx',
	],
	['prefers module.ts when both exist', ['src/module.ts', 'src/module.tsx'], 'src/plugin.json', './pkg/src/module.ts'],
];

for (const [name, files, pluginJson, expected] of found) {
	test(name, (t) => {
		const r = find(t, files, pluginJson);
		assert.equal(r.status, 0, r.stderr);
		assert.equal(r.path, expected);
	});
}

test('fails with an annotation when there is no module', (t) => {
	const r = find(t, ['src/plugin.json']);
	assert.equal(r.status, 1);
	assert.match(r.stdout, /^::error file=pkg\/src\/plugin.json::no module.ts or module.tsx/m);
	assert.equal(r.path, undefined);
});
