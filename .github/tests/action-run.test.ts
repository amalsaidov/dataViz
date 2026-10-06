// discover-plugins/run.sh: base selection for changed-only, and the outputs.
// discover.sh is replaced by a stub that echoes its arguments, so these tests
// cover only the entry point's own logic.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, test, type TestContext } from 'node:test';
import { ACTION_RUN, bash, readOutputs, tempDir, writeText } from './helpers.ts';

function run(t: TestContext, env: Record<string, string>): { args: string[]; e2e: string } {
	const dir = tempDir(t);
	writeText(
		join(dir, 'discover.sh'),
		// Prints {"targets":[<args>],"e2e":[]} so the test can see what was passed.
		'printf \'{"targets":%s,"e2e":[]}\\n\' "$(printf \'%s\\n\' "$@" | jq -Rsc \'split("\\n") | map(select(length > 0))\')"\n'
	);
	const output = join(dir, 'output');
	writeText(output, '');
	const r = bash(ACTION_RUN, [], {
		env: { ROOT: 'plugins/packages/@plugins', CHANGED_ONLY: 'false', PR_BASE: '', PUSH_BEFORE: '', ACTION_PATH: dir, GITHUB_OUTPUT: output, ...env },
	});
	assert.equal(r.status, 0, r.stderr);
	const outputs = readOutputs(output);
	return { args: JSON.parse(outputs.targets), e2e: outputs.e2e };
}

describe('base selection', () => {
	test('changed-only off passes no base', (t) => {
		assert.deepEqual(run(t, { PR_BASE: 'abc123' }).args, ['plugins/packages/@plugins']);
	});

	test('pull_request uses the PR base', (t) => {
		assert.deepEqual(run(t, { CHANGED_ONLY: 'true', PR_BASE: 'abc123', PUSH_BEFORE: 'def456' }).args, [
			'plugins/packages/@plugins',
			'abc123',
		]);
	});

	test('push uses the previous commit', (t) => {
		assert.deepEqual(run(t, { CHANGED_ONLY: 'true', PUSH_BEFORE: 'def456' }).args, ['plugins/packages/@plugins', 'def456']);
	});

	test('a branch-creating push (all-zero before) passes no base', (t) => {
		assert.deepEqual(run(t, { CHANGED_ONLY: 'true', PUSH_BEFORE: '0'.repeat(40) }).args, ['plugins/packages/@plugins']);
	});

	test('no event base (workflow_dispatch) passes no base', (t) => {
		assert.deepEqual(run(t, { CHANGED_ONLY: 'true' }).args, ['plugins/packages/@plugins']);
	});
});

test('writes both lists as compact single-line outputs', (t) => {
	assert.equal(run(t, {}).e2e, '[]');
});
