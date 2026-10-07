// scripts/prune-turbo-cache.sh: keeping only the cache entries the last run used.
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { SCRIPTS, bash, tempDir, writeJson, writeText } from './helpers.ts';

const SCRIPT = join(SCRIPTS, 'prune-turbo-cache.sh');

/** Writes the three files turbo keeps per cache entry. */
function cacheEntry(cacheDir: string, hash: string): void {
	writeText(join(cacheDir, `${hash}.tar.zst`), 'x');
	writeText(join(cacheDir, `${hash}-meta.json`), '{}');
	writeText(join(cacheDir, `${hash}-manifest.json`), '{}');
}

describe('scripts/prune-turbo-cache.sh', () => {
	test('keeps the entries the summarized runs used and removes the rest', (t) => {
		const turbo = tempDir(t);
		const cacheDir = join(turbo, 'cache');
		const runsDir = join(turbo, 'runs');
		for (const hash of ['aaaa111122223333', 'bbbb111122223333', 'cccc111122223333']) {
			cacheEntry(cacheDir, hash);
		}
		writeJson(join(runsDir, 'lint.json'), { tasks: [{ hash: 'aaaa111122223333' }] });
		writeJson(join(runsDir, 'test.json'), { tasks: [{ hash: 'cccc111122223333' }] });

		const prune = bash(SCRIPT, [cacheDir, runsDir]);
		assert.equal(prune.status, 0, prune.stderr);
		assert.deepEqual(readdirSync(cacheDir).sort(), [
			'aaaa111122223333-manifest.json',
			'aaaa111122223333-meta.json',
			'aaaa111122223333.tar.zst',
			'cccc111122223333-manifest.json',
			'cccc111122223333-meta.json',
			'cccc111122223333.tar.zst',
		]);
		assert.match(prune.stdout, /kept 6 files, removed 3/);
	});

	test('leaves the cache alone, with a warning, when there are no summaries', (t) => {
		const turbo = tempDir(t);
		const cacheDir = join(turbo, 'cache');
		cacheEntry(cacheDir, 'aaaa111122223333');

		const prune = bash(SCRIPT, [cacheDir, join(turbo, 'runs')]);
		assert.equal(prune.status, 0, prune.stderr);
		assert.match(prune.stdout, /::warning::no turbo run summaries/);
		assert.equal(readdirSync(cacheDir).length, 3);
	});
});
