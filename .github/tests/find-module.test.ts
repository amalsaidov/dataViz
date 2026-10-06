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

test('finds module.ts next to plugin.json', (t) => {
	const r = find(t, ['src/plugin.json', 'src/module.ts']);
	assert.equal(r.status, 0, r.stderr);
	assert.equal(r.path, './pkg/src/module.ts');
});

test('finds module.tsx for a nested target', (t) => {
	const r = find(t, ['src/modules/relations/plugin.json', 'src/modules/relations/module.tsx'], 'src/modules/relations/plugin.json');
	assert.equal(r.path, './pkg/src/modules/relations/module.tsx');
});

test('prefers module.ts when both exist', (t) => {
	assert.equal(find(t, ['src/module.ts', 'src/module.tsx']).path, './pkg/src/module.ts');
});

test('fails with an annotation when there is no module', (t) => {
	const r = find(t, ['src/plugin.json']);
	assert.equal(r.status, 1);
	assert.match(r.stdout, /^::error file=pkg\/src\/plugin.json::no module.ts or module.tsx/m);
	assert.equal(r.path, undefined);
});
