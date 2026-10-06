// scripts/build-targets.sh, with a fake `pnpm` on PATH so no real build runs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { SCRIPTS, bash, errors, tempDir, writeText } from './helpers.ts';

const SCRIPT = join(SCRIPTS, 'build-targets.sh');

// The fake pnpm logs every call, and on `--filter <pkg> run <script>` writes
// dist/plugin.json with the id FAKE_BUILT_<script> names (default: the
// package's own id from FAKE_IDS), or fails when the script is `fail`.
const FAKE_PNPM = `#!/usr/bin/env bash
echo "pnpm $*" >> "$FAKE_LOG"
if [ "$1" = --filter ] && [ "$3" = run ]; then
  pkg="$2"; script="$4"
  [ "$script" = fail ] && { echo "build failed" >&2; exit 2; }
  [ "$script" = nodist ] && exit 0
  dir="$(jq -r --arg p "$pkg" '.[$p].dir' <<<"$FAKE_IDS")"
  id="$(jq -r --arg p "$pkg" --arg s "$script" '.[$p].built[$s] // .[$p].id' <<<"$FAKE_IDS")"
  mkdir -p "$GITHUB_WORKSPACE/$dir/dist"
  printf '{"id":"%s"}' "$id" > "$GITHUB_WORKSPACE/$dir/dist/plugin.json"
fi
`;

interface Target {
	dir: string;
	pkg: string;
	id: string;
	script: string;
}

/** Per package: where it lives, its id, and ids particular scripts build instead. */
type FakeIds = Record<string, { dir: string; id: string; built?: Record<string, string> }>;

function setup(t: TestContext, targets: Target[], fakeIds: FakeIds) {
	const ws = tempDir(t);
	const bin = join(ws, 'bin');
	writeText(join(bin, 'pnpm'), FAKE_PNPM, { executable: true });
	const log = join(ws, 'pnpm.log');
	writeText(log, '');
	const r = bash(SCRIPT, [], {
		cwd: ws,
		env: {
			PATH: `${bin}:${process.env.PATH}`,
			TARGETS: JSON.stringify(targets),
			GITHUB_WORKSPACE: ws,
			FAKE_LOG: log,
			FAKE_IDS: JSON.stringify(fakeIds),
		},
	});
	return { ...r, calls: readFileSync(log, 'utf8').trim().split('\n').filter(Boolean) };
}

const clock: Target = { dir: 'p/clock', pkg: '@t/clock', id: 'clock-panel', script: 'build' };
const relations: Target = { dir: 'p/echarts', pkg: '@t/echarts', id: 'relations-panel', script: 'build:relations' };
const ids: FakeIds = {
	'@t/clock': { dir: 'p/clock', id: 'clock-panel' },
	'@t/echarts': { dir: 'p/echarts', id: 'relations-panel', built: { build: 'echarts-app' } },
};

test('builds every target in order, deps first, inside log groups', (t) => {
	const r = setup(t, [clock, relations], ids);
	assert.equal(r.status, 0, r.stderr);
	assert.deepEqual(r.calls, [
		'pnpm turbo run build --filter @t/clock^...',
		'pnpm --filter @t/clock run build',
		'pnpm turbo run build --filter @t/echarts^...',
		'pnpm --filter @t/echarts run build:relations',
	]);
	assert.match(r.stdout, /::group::@t\/clock → clock-panel/);
	assert.match(r.stdout, /::group::@t\/echarts → relations-panel/);
});

test('fails when the build put a different plugin in dist/', (t) => {
	const r = setup(t, [{ ...relations, script: 'build' }], ids);
	assert.equal(r.status, 1);
	assert.match(r.stdout, /::error file=p\/echarts\/dist\/plugin.json::.*built 'echarts-app', expected 'relations-panel'/);
});

test('fails with an annotation when the build wrote no dist/plugin.json', (t) => {
	const r = setup(t, [{ ...clock, script: 'nodist' }], ids);
	assert.equal(r.status, 1);
	assert.match(r.stdout, /::error file=p\/clock\/package.json::.*wrote no dist\/plugin.json/);
});

test('stops at the first failing build', (t) => {
	const r = setup(t, [{ ...clock, script: 'fail' }, relations], ids);
	assert.notEqual(r.status, 0);
	assert.ok(!r.calls.some((c) => c.includes('@t/echarts')), 'later targets are not built');
});

test('fails rather than passing green when there are no targets', (t) => {
	const r = setup(t, [], ids);
	assert.equal(r.status, 1);
	assert.equal(errors(r.stdout).length, 1);
	assert.deepEqual(r.calls, []);
});
