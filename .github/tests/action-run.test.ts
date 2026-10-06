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

describe('discover-plugins/run.sh', () => {
	describe('base selection', () => {
		const ROOT = 'plugins/packages/@plugins';
		// [case, env, expected discover.sh arguments]
		const cases: [string, Record<string, string>, string[]][] = [
			['changed-only off passes no base', { PR_BASE: 'abc123' }, [ROOT]],
			['pull_request uses the PR base', { CHANGED_ONLY: 'true', PR_BASE: 'abc123', PUSH_BEFORE: 'def456' }, [ROOT, 'abc123']],
			['push uses the previous commit', { CHANGED_ONLY: 'true', PUSH_BEFORE: 'def456' }, [ROOT, 'def456']],
			['a branch-creating push (all-zero before) passes no base', { CHANGED_ONLY: 'true', PUSH_BEFORE: '0'.repeat(40) }, [ROOT]],
			['no event base (workflow_dispatch) passes no base', { CHANGED_ONLY: 'true' }, [ROOT]],
		];

		for (const [name, env, expected] of cases) {
			test(name, (t) => {
				assert.deepEqual(run(t, env).args, expected);
			});
		}
	});

	test('writes targets and e2e as compact single-line outputs', (t) => {
		assert.equal(run(t, {}).e2e, '[]');
	});
});
