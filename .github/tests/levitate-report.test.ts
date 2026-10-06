// scripts/levitate-report.sh: what compatibility-report gets for each verdict.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test, type TestContext } from 'node:test';
import { FIXTURES, SCRIPTS, bash, tempDir, writeText } from './helpers.ts';

const SCRIPT = join(SCRIPTS, 'levitate-report.sh');
const ENV = { ID: 'clock-panel', MODULE: './plugins/x/src/module.ts', RUN_URL: 'https://example.test/runs/1' };

function report(t: TestContext, levitateOutput: string) {
	const outDir = join(tempDir(t), 'levitate-report');
	const script = bash(SCRIPT, [levitateOutput, outDir], { env: ENV });
	assert.equal(script.status, 0, script.stderr);
	const commentPath = join(outDir, 'comment.md');
	return {
		stdout: script.stdout,
		clean: existsSync(join(outDir, 'clean')),
		comment: existsSync(commentPath) ? readFileSync(commentPath, 'utf8') : undefined,
	};
}

describe('scripts/levitate-report.sh', () => {
	test('writes only a clean marker when levitate found the module compatible', (t) => {
		const levitateOutput = join(tempDir(t), 'report.txt');
		writeText(levitateOutput, './src/module.ts appears to be compatible with @grafana/data\n');
		const result = report(t, levitateOutput);
		assert.ok(result.clean);
		assert.equal(result.comment, undefined);
		assert.doesNotMatch(result.stdout, /::warning/);
	});

	test('warns and writes the incompatibility comment', (t) => {
		const result = report(t, join(FIXTURES, 'levitate-incompatible.txt'));
		assert.ok(!result.clean);
		assert.match(result.stdout, /^::warning title=Grafana API compatibility \(clock-panel\)::.*may be incompatible/m);
		assert.match(result.comment ?? '', /may be incompatible/);
	});

	test('warns and writes a did-not-finish comment when levitate stopped early', (t) => {
		const levitateOutput = join(tempDir(t), 'report.txt');
		writeText(levitateOutput, 'npm error code ETIMEDOUT\n');
		const result = report(t, levitateOutput);
		assert.ok(!result.clean);
		assert.match(result.stdout, /::warning.*levitate did not finish checking/);
		assert.match(result.comment ?? '', /levitate did not finish checking/);
	});
});
