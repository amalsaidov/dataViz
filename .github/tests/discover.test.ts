// discover.sh: build targets, e2e detection, validation, changed-only filtering.
import assert from 'node:assert/strict';
import { renameSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test, type TestContext } from 'node:test';
import { DISCOVER, type PkgOptions, type RunResult, bash, errors, git, mkPkg, tempDir, writeText } from './helpers.ts';

interface Target {
	dir: string;
	pkg: string;
	id: string;
	script: string;
	plugin_json: string;
}
interface E2e {
	dir: string;
	pkg: string;
	url: string;
	grafana_dependency: string;
}

function discover(root: string, args: string[] = [], cwd?: string): RunResult {
	return bash(DISCOVER, [root, ...args], cwd ? { cwd } : {});
}

function ok(result: RunResult): { targets: Target[]; e2e: E2e[] } {
	assert.equal(result.status, 0, result.stderr);
	return JSON.parse(result.stdout);
}

describe('discover-plugins/discover.sh', () => {
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
		test('lists only packages with both an e2e script and playwright.config.ts, at :3000 by default', (t) => {
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
		// Each case: [name, package options, expected error substring].
		const cases: [string, PkgOptions, string][] = [
			['rejects a target id that is not lowercase-kebab', { id: 'x', pluginCi: { targets: [{ id: 'Bad_Id', script: 'build', pluginJson: 'src/plugin.json' }] } }, 'must match'],
			['rejects a target script that package.json does not define', { id: 'x', pluginCi: { targets: [{ id: 'x', script: 'build:nope', pluginJson: 'src/plugin.json' }] } }, "script 'build:nope' is not in"],
			['rejects a target pluginJson that does not exist', { id: 'x', pluginCi: { targets: [{ id: 'x', script: 'build', pluginJson: 'src/missing.json' }] } }, 'does not exist'],
			['rejects a target whose pluginJson has a different id', { id: 'actual', pluginCi: { targets: [{ id: 'declared', script: 'build', pluginJson: 'src/plugin.json' }] } }, "has id 'actual'"],
			['rejects an empty targets list', { id: 'x', pluginCi: { targets: [] } }, 'non-empty array'],
			['rejects a package with no targets and no src/plugin.json id', {}, 'no build target'],
			['rejects an e2e script without playwright.config.ts', { id: 'x', scripts: { build: 'x', e2e: 'x' } }, 'no playwright.config.ts'],
			['rejects playwright.config.ts without an e2e script', { id: 'x', playwright: true }, 'has no e2e script'],
			['rejects an e2e suite with no grafanaDependency to pick versions from', { id: 'x', scripts: { build: 'x', e2e: 'x' }, playwright: true, grafanaDependency: '' }, 'no dependencies.grafanaDependency'],
		];

		for (const [name, opts, expected] of cases) {
			test(name, (t) => {
				const root = tempDir(t);
				mkPkg(root, 'p', opts);
				const r = discover(root);
				assert.equal(r.status, 1);
				assert.equal(r.stdout, '', 'nothing on stdout when discovery fails');
				const errs = errors(r.stderr);
				assert.equal(errs.length, 1, r.stderr);
				assert.ok(errs[0].includes(expected), errs[0]);
			});
		}

		test('rejects the same plugin id in two packages', (t) => {
			const root = tempDir(t);
			mkPkg(root, 'a', { id: 'same-panel' });
			mkPkg(root, 'b', { id: 'same-panel' });
			const r = discover(root);
			assert.equal(r.status, 1);
			assert.match(errors(r.stderr).join('\n'), /declared more than once/);
		});

		test('reports every error before exiting, not just the first', (t) => {
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
		function repo(t: TestContext): { cwd: string; root: string; base: string } {
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

		function change(cwd: string, path: string): void {
			writeText(join(cwd, path), `// ${Math.random()}\n`);
			git(cwd, 'add', '-A');
			git(cwd, 'commit', '-qm', 'change');
		}

		function selected(cwd: string, root: string, base: string): { t: string[]; e: string[] } {
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
});
