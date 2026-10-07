// scripts/levitate-verdict.sh: telling "compatible" from "levitate never finished".
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { FIXTURES, SCRIPTS, bash, tempDir, writeText } from './helpers.ts';

const SCRIPT = join(SCRIPTS, 'levitate-verdict.sh');

function verdictFor(reportPath: string): string {
	const script = bash(SCRIPT, [reportPath]);
	assert.equal(script.status, 0, script.stderr);
	return script.stdout.trim();
}

describe('scripts/levitate-verdict.sh', () => {
	test('reports incompatible for a report with findings', () => {
		assert.equal(verdictFor(join(FIXTURES, 'levitate-incompatible.txt')), 'incompatible');
	});

	test('reports compatible only when levitate says so', (t) => {
		const report = join(tempDir(t), 'report.txt');
		writeText(report, '✔️  ./src/module.ts appears to be compatible with @grafana/data,@grafana/ui\n');
		assert.equal(verdictFor(report), 'compatible');
	});

	test('reports unknown when levitate stopped without a verdict', (t) => {
		const report = join(tempDir(t), 'report.txt');
		writeText(report, '🔍 Resolving @grafana/data@latest...\nnpm error code ETIMEDOUT\n');
		assert.equal(verdictFor(report), 'unknown');
	});

	test('reports unknown when there is no report at all', (t) => {
		assert.equal(verdictFor(join(tempDir(t), 'missing.txt')), 'unknown');
	});
});
