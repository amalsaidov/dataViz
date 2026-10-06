// discover.sh: build targets, e2e detection, validation, changed-only filtering.
import assert from 'node:assert/strict';
import { renameSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { DISCOVER, bash, errors, git, mkPkg, tempDir, writeText } from './helpers.mjs';

function discover(root, args = [], cwd) {
	return bash(DISCOVER, [root, ...args], cwd ? { cwd } : {});
}

function ok(result) {
	assert.equal(result.status, 0, result.stderr);
	return JSON.parse(result.stdout);
}

describe('targets', () => {
	test('a package without plugin-ci.json has one implicit target', (t) => {
		const root = tempDir(t);
		mkPkg(root, 'clock', { id: 'clock-panel' });
		const { targets } = ok(discover(root));
		assert.deepEqual(targets, [
			{
				dir: join(root, 'clock'),
				pkg: '@t/clock',
				id: 'clock-panel',
				script: 'build',
				plugin_json: 'src/plugin.json',
			},
		]);
	});

	test('declared targets replace the implicit one', (t) => {
		const root = tempDir(t);
		const dir = mkPkg(root, 'echarts', {
			id: 'echarts-app',
			scripts: { build: 'x', 'build:relations': 'x' },
			pluginCi: {
				targets: [{ id: 'relations-panel', script: 'build:relations', pluginJson: 'src/modules/relations/plugin.json' }],
			},
		});
		writeText(join(dir, 'src/modules/relations/plugin.json'), JSON.stringify({ id: 'relations-panel' }));
		const { targets } = ok(discover(root));
		assert.deepEqual(
			targets.map((x) => [x.id, x.script]),
			[['relations-panel', 'build:relations']]
		);
	});

	test('a plugin-ci.json with only e2e keeps the implicit target', (t) => {
		const root = tempDir(t);
		mkPkg(root, 'p', { id: 'p-panel', pluginCi: { e2e: { url: 'http://127.0.0.1:4000' } } });
		const { targets } = ok(discover(root));
		assert.deepEqual(
			targets.map((x) => x.id),
			['p-panel']
		);
	});
});

describe('e2e', () => {
	test('needs both an e2e script and playwright.config.ts; url defaults to :3000', (t) => {
		const root = tempDir(t);
		mkPkg(root, 'with', { id: 'with-panel', scripts: { build: 'x', e2e: 'x' }, playwright: true });
		mkPkg(root, 'without', { id: 'without-panel' });
		const { e2e } = ok(discover(root));
		assert.deepEqual(e2e, [
			{ dir: join(root, 'with'), pkg: '@t/with', url: 'http://127.0.0.1:3000', grafana_dependency: '>=12.0.0' },
		]);
	});

	test('e2e.url overrides the default', (t) => {
		const root = tempDir(t);
		mkPkg(root, 'p', {
			id: 'p-panel',
			scripts: { build: 'x', e2e: 'x' },
			playwright: true,
			pluginCi: { e2e: { url: 'http://127.0.0.1:3020' } },
		});
		assert.equal(ok(discover(root)).e2e[0].url, 'http://127.0.0.1:3020');
	});
});

describe('validation', () => {
	// Each case: [package name, package options, extra setup, expected error substring].
	const cases = [
		['bad id', { id: 'x', pluginCi: { targets: [{ id: 'Bad_Id', script: 'build', pluginJson: 'src/plugin.json' }] } }, null, 'must match'],
		['missing script', { id: 'x', pluginCi: { targets: [{ id: 'x', script: 'build:nope', pluginJson: 'src/plugin.json' }] } }, null, "script 'build:nope' is not in"],
		['missing pluginJson', { id: 'x', pluginCi: { targets: [{ id: 'x', script: 'build', pluginJson: 'src/missing.json' }] } }, null, 'does not exist'],
		['id mismatch', { id: 'actual', pluginCi: { targets: [{ id: 'declared', script: 'build', pluginJson: 'src/plugin.json' }] } }, null, "has id 'actual'"],
		['empty targets', { id: 'x', pluginCi: { targets: [] } }, null, 'non-empty array'],
		['no identity', {}, null, 'no build target'],
		['e2e script without config', { id: 'x', scripts: { build: 'x', e2e: 'x' } }, null, 'no playwright.config.ts'],
		['config without e2e script', { id: 'x', playwright: true }, null, 'has no e2e script'],
		['e2e without grafanaDependency', { id: 'x', scripts: { build: 'x', e2e: 'x' }, playwright: true, grafanaDependency: '' }, null, 'no dependencies.grafanaDependency'],
	];

	for (const [name, opts, , expected] of cases) {
		test(name, (t) => {
			const root = tempDir(t);
			mkPkg(root, 'p', opts);
			const r = discover(root);
			assert.equal(r.status, 1);
			assert.equal(r.stdout, '', 'nothing on stdout when discovery fails');
			const errs = errors(r.stderr);
			assert.equal(errs.length, 1, r.stderr);
			assert.match(errs[0], new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
		});
	}

	test('duplicate ids across packages', (t) => {
		const root = tempDir(t);
		mkPkg(root, 'a', { id: 'same-panel' });
		mkPkg(root, 'b', { id: 'same-panel' });
		const r = discover(root);
		assert.equal(r.status, 1);
		assert.match(errors(r.stderr).join('\n'), /declared more than once/);
	});

	test('reports every error before exiting', (t) => {
		const root = tempDir(t);
		mkPkg(root, 'a', {});
		mkPkg(root, 'b', { id: 'x', playwright: true });
		const r = discover(root);
		assert.equal(r.status, 1);
		assert.equal(errors(r.stderr).length, 2, r.stderr);
	});
});

describe('changed-only', () => {
	// A temp repo laid out like this one, so paths match the real rules.
	function repo(t) {
		const cwd = tempDir(t);
		const root = 'plugins/packages/@plugins';
		git(cwd, 'init', '-q', '-b', 'main');
		mkPkg(join(cwd, root), 'clock', { id: 'clock-panel', scripts: { build: 'x', e2e: 'x' }, playwright: true });
		mkPkg(join(cwd, root), 'echarts', { id: 'echarts-app' });
		writeText(join(cwd, 'plugins/pnpm-lock.yaml'), 'lockfileVersion: 9\n');
		writeText(join(cwd, 'plugins/.shared/webpack-shared.mjs'), 'export {};\n');
		git(cwd, 'add', '-A');
		git(cwd, 'commit', '-qm', 'base');
		return { cwd, root, base: git(cwd, 'rev-parse', 'HEAD') };
	}

	function change(cwd, path) {
		writeText(join(cwd, path), `// ${Math.random()}\n`);
		git(cwd, 'add', '-A');
		git(cwd, 'commit', '-qm', 'change');
	}

	function selected(cwd, root, base) {
		const out = ok(discover(root, [base], cwd));
		return { t: out.targets.map((x) => x.id), e: out.e2e.map((x) => x.pkg) };
	}

	test('a change inside one package selects only that package', (t) => {
		const { cwd, root, base } = repo(t);
		change(cwd, `${root}/clock/src/module.ts`);
		assert.deepEqual(selected(cwd, root, base), { t: ['clock-panel'], e: ['@t/clock'] });
	});

	test('no relevant change selects nothing', (t) => {
		const { cwd, root, base } = repo(t);
		change(cwd, 'README.md');
		assert.deepEqual(selected(cwd, root, base), { t: [], e: [] });
	});

	for (const path of [
		'plugins/pnpm-lock.yaml',
		'plugins/.shared/webpack-shared.mjs',
		'plugins/turbo.json',
		'.github/actions/discover-plugins/discover.sh',
		'.github/workflows/plugin-ci.yml',
	]) {
		test(`${path} selects every package`, (t) => {
			const { cwd, root, base } = repo(t);
			change(cwd, path);
			assert.deepEqual(selected(cwd, root, base).t.sort(), ['clock-panel', 'echarts-app']);
		});
	}

	test('a file moved out of a package selects the package it left', (t) => {
		// Without --no-renames, git reports only the new path and clock is missed.
		const { cwd, root } = repo(t);
		writeText(join(cwd, root, 'clock/src/moved.ts'), 'export const x = 1;\n'.repeat(20));
		git(cwd, 'add', '-A');
		git(cwd, 'commit', '-qm', 'add');
		const before = git(cwd, 'rev-parse', 'HEAD');
		renameSync(join(cwd, root, 'clock/src/moved.ts'), join(cwd, root, 'echarts/moved.ts'));
		git(cwd, 'add', '-A');
		git(cwd, 'commit', '-qm', 'move');
		assert.deepEqual(selected(cwd, root, before).t.sort(), ['clock-panel', 'echarts-app']);
	});

	test('an unusable base warns and selects everything', (t) => {
		const { cwd, root } = repo(t);
		const r = discover(root, ['0123456789abcdef0123456789abcdef01234567'], cwd);
		assert.equal(r.status, 0, r.stderr);
		assert.match(r.stderr, /::warning::cannot diff against/);
		assert.equal(JSON.parse(r.stdout).targets.length, 2);
	});
});
