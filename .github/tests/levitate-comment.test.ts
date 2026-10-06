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

/** Lines that open or close one of the comment's own (tilde) code blocks. */
function fences(body: string): number {
	return body.split('\n').filter((line) => line.startsWith('~~~')).length;
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

	test('says levitate did not finish when the verdict is unknown', (t) => {
		const report = join(tempDir(t), 'report.txt');
		writeText(report, 'npm error code ETIMEDOUT\n');
		const commentPath = join(tempDir(t), 'comment.md');
		const script = bash(SCRIPT, [report, commentPath], { env: { ...ENV, VERDICT: 'unknown' } });
		assert.equal(script.status, 0, script.stderr);
		const body = readFileSync(commentPath, 'utf8');
		assert.match(body, /levitate did not finish checking `\.\/plugins\/x\/src\/module\.ts`/);
		assert.doesNotMatch(body, /may be incompatible/);
	});

	test('lists at most 50 incompatibilities and says how many more there are', (t) => {
		const report = join(tempDir(t), 'report.txt');
		const lines = ['Comparing @grafana/data@12.0.0 to @grafana/data@13.0.0'];
		for (let number = 1; number <= 80; number++) {
			lines.push(`${number}) Changed \`thing${number}\` used in \`src/file${number}.ts:1\``);
		}
		writeText(report, `${lines.join('\n')}\n`);
		const summary = comment(t, report).split('<details>')[0];
		const listed = summary.split('\n').filter((line) => /^\d+\) Changed/.test(line));
		assert.equal(listed.length, 50);
		assert.match(summary, /… 30 more in the full report/);
	});

	test('keeps the whole comment under the limit when the list is long too', (t) => {
		const report = join(tempDir(t), 'report.txt');
		// 50 findings of ~830 characters each, then a 100 KB report.
		const longPath = `${'a/'.repeat(400)}module.ts`;
		const lines: string[] = [];
		for (let number = 1; number <= 50; number++) {
			lines.push(`${number}) Changed \`config\` used in \`${longPath}:1\``);
		}
		writeText(report, `${lines.join('\n')}\n${'x'.repeat(100_000)}`);
		const body = comment(t, report);
		assert.ok(body.length < 65_536, `comment is ${body.length} chars`);
		assert.equal(fences(body) % 2, 0);
	});

	test('stays under the limit even when the header lines alone would not fit', (t) => {
		const report = join(tempDir(t), 'report.txt');
		// 500 long "Comparing" lines: far more summary than the comment can hold.
		const lines: string[] = [];
		for (let number = 1; number <= 500; number++) {
			lines.push(`Comparing @grafana/${'package'.repeat(30)}${number}@1.0.0 to @grafana/package${number}@2.0.0`);
		}
		writeText(report, `${lines.join('\n')}\n`);
		const body = comment(t, report);
		assert.ok(body.length < 65_536, `comment is ${body.length} chars`);
		assert.equal(fences(body) % 2, 0);
	});

	test('keeps the ```diff blocks from levitate inside the folded report', (t) => {
		// levitate --markdown wraps each type diff in a ```diff block; those
		// backtick lines must not end the comment's code block early.
		const report = join(tempDir(t), 'report.txt');
		writeText(
			report,
			[
				'Comparing @grafana/data@12.0.0 to @grafana/data@13.0.0',
				'1) Changed `PanelProps` used in `src/module.ts:3`',
				'```diff',
				'- width: number',
				'+ width?: number',
				'```',
				'is not fully compatible',
				'',
			].join('\n')
		);
		const body = comment(t, report);
		const details = body.slice(body.indexOf('<details>'));
		const opening = details.indexOf('~~~text');
		const closing = details.lastIndexOf('~~~');
		assert.ok(opening < details.indexOf('```diff') && details.indexOf('```diff') < closing, 'the diff stays inside the code block');
		assert.ok(closing < details.indexOf('</details>'), 'the code block closes before </details>');
	});

	test('does not fail when the cut lands inside a multibyte character', (t) => {
		// iconv -c drops the cut character but exits 1; that must not fail the
		// script. The report is all 4-byte emoji after a 0-3 byte prefix, so at
		// least three of these four runs cut through the middle of one.
		for (const prefix of ['', 'a', 'ab', 'abc']) {
			const report = join(tempDir(t), 'report.txt');
			writeText(report, `${prefix}${'🔍'.repeat(20_000)}`);
			const body = comment(t, report);
			assert.match(body, /~~~\n\n<\/details>\n$/, `prefix '${prefix}'`);
		}
	});

	test('truncates a huge report and still closes the fence', (t) => {
		const report = join(tempDir(t), 'report.txt');
		writeText(report, 'x'.repeat(100_000)); // no trailing newline, cut mid-line
		const body = comment(t, report);
		assert.ok(body.length < 65_536, `comment is ${body.length} chars`);
		assert.equal(fences(body) % 2, 0);
		assert.match(body, /x\n~~~\n\n<\/details>\n$/);
	});
});
