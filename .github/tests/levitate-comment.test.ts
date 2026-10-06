// scripts/levitate-comment.sh: the PR comment body built from levitate output.
// fixtures/levitate-incompatible.txt is real output from clock-panel's run.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test, type TestContext } from 'node:test';
import { FIXTURES, SCRIPTS, bash, tempDir, writeText } from './helpers.ts';

const SCRIPT = join(SCRIPTS, 'levitate-comment.sh');
const ENV = { ID: 'clock-panel', MODULE: './plugins/x/src/module.ts', RUN_URL: 'https://example.test/runs/1' };

function comment(t: TestContext, reportPath: string): string {
	const commentPath = join(tempDir(t), 'comment.md');
	const script = bash(SCRIPT, [reportPath, commentPath], { env: ENV });
	assert.equal(script.status, 0, script.stderr);
	return readFileSync(commentPath, 'utf8');
}

function fences(body: string): number {
	return body.split('\n').filter((line) => line.startsWith('```')).length;
}

describe('scripts/levitate-comment.sh', () => {
	test('leads with the comparison and numbered incompatibilities', (t) => {
		const body = comment(t, join(FIXTURES, 'levitate-incompatible.txt'));
		const summary = body.split('<details>')[0];
		assert.match(summary, /^### Grafana API compatibility: `clock-panel`/);
		assert.match(summary, /\[Full run\]\(https:\/\/example\.test\/runs\/1\)/);
		assert.match(summary, /^Comparing @grafana\/runtime@12\.2\.10 to @grafana\/runtime@13\.2\.3$/m);
		const numbered = summary.split('\n').filter((line) => /^\d+\) Changed `config`/.test(line));
		assert.equal(numbered.length, 3);
		assert.doesNotMatch(summary, /Resolving/, 'progress noise stays in the folded report');
	});

	test('folds the full report into a closed details block', (t) => {
		const body = comment(t, join(FIXTURES, 'levitate-incompatible.txt'));
		assert.match(body, /<details><summary>Full levitate report<\/summary>[\s\S]*Resolving @grafana\/data@latest[\s\S]*<\/details>\n$/);
		assert.equal(fences(body) % 2, 0, 'code fences are balanced');
	});

	test('says so when nothing is itemized', (t) => {
		const report = join(tempDir(t), 'report.txt');
		writeText(report, 'something went wrong\n');
		assert.match(comment(t, report), /\(no itemized incompatibilities; see the full report\)/);
	});

	test('truncates a huge report and still closes the fence', (t) => {
		const report = join(tempDir(t), 'report.txt');
		writeText(report, 'x'.repeat(100_000)); // no trailing newline, cut mid-line
		const body = comment(t, report);
		assert.ok(body.length < 65_536, `comment is ${body.length} chars`);
		assert.equal(fences(body) % 2, 0);
		assert.match(body, /x\n```\n\n<\/details>\n$/);
	});
});
