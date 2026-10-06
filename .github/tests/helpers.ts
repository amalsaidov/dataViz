// Shared helpers for the CI script tests. Run the suite from the repo root:
//   node --test --test-concurrency=1 '.github/tests/*.test.ts'
// Node runs these .ts files directly by stripping the types, so only
// erasable syntax is allowed (no enum, namespace or parameter properties).
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import type { TestContext } from 'node:test';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const DISCOVER = join(REPO, '.github/actions/discover-plugins/discover.sh');
export const ACTION_RUN = join(REPO, '.github/actions/discover-plugins/run.sh');
export const SCRIPTS = join(REPO, '.github/scripts');
export const FIXTURES = join(REPO, '.github/tests/fixtures');

export interface RunResult {
	status: number | null;
	stdout: string;
	stderr: string;
}

/** Runs `bash <script> ...args`. */
export function bash(
	script: string,
	args: string[] = [],
	{ env = {}, cwd = REPO }: { env?: Record<string, string | undefined>; cwd?: string } = {}
): RunResult {
	const r = spawnSync('bash', [script, ...args], {
		cwd,
		encoding: 'utf8',
		// A clean env, so values from the developer's shell (or a real
		// GITHUB_OUTPUT) can't leak into a test.
		env: { PATH: process.env.PATH, HOME: process.env.HOME, ...env },
	});
	return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

/** Creates a temp dir and registers its removal with the test context. */
export function tempDir(t: TestContext, prefix = 'ci-test-'): string {
	const dir = mkdtempSync(join(tmpdir(), prefix));
	t.after(() => rmSync(dir, { recursive: true, force: true }));
	return dir;
}

export function writeJson(path: string, value: unknown): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, JSON.stringify(value, null, 2));
}

export function writeText(path: string, text: string, { executable = false } = {}): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, text);
	if (executable) {
		chmodSync(path, 0o755);
	}
}

/**
 * Writes a plugin package under <root>/<name>.
 * - id: src/plugin.json id (omit for none)
 * - scripts: package.json scripts (default { build: 'x' })
 * - grafanaDependency: written into src/plugin.json when id is set
 * - pluginCi: plugin-ci.json contents (omit for no file)
 * - playwright: create playwright.config.ts
 */
export interface PkgOptions {
	id?: string;
	scripts?: Record<string, string>;
	grafanaDependency?: string;
	pluginCi?: unknown;
	playwright?: boolean;
}

export function mkPkg(
	root: string,
	name: string,
	{ id, scripts = { build: 'x' }, grafanaDependency = '>=12.0.0', pluginCi, playwright = false }: PkgOptions = {}
): string {
	const dir = join(root, name);
	writeJson(join(dir, 'package.json'), { name: `@t/${name}`, scripts });
	if (id !== undefined) {
		writeJson(join(dir, 'src/plugin.json'), { id, dependencies: { grafanaDependency } });
	}
	if (pluginCi !== undefined) {
		writeJson(join(dir, 'plugin-ci.json'), pluginCi);
	}
	if (playwright) {
		writeText(join(dir, 'playwright.config.ts'), 'export default {};\n');
	}
	return dir;
}

/** Parses a $GITHUB_OUTPUT file of single-line `key=value` entries. */
export function readOutputs(path: string): Record<string, string> {
	const out: Record<string, string> = {};
	for (const line of readFileSync(path, 'utf8').split('\n')) {
		const i = line.indexOf('=');
		if (i > 0) {
			out[line.slice(0, i)] = line.slice(i + 1);
		}
	}
	return out;
}

/** Runs git in `cwd`, throwing on failure. */
export function git(cwd: string, ...args: string[]): string {
	const r = spawnSync('git', args, {
		cwd,
		encoding: 'utf8',
		env: {
			PATH: process.env.PATH,
			HOME: process.env.HOME,
			GIT_AUTHOR_NAME: 't',
			GIT_AUTHOR_EMAIL: 't@example.com',
			GIT_COMMITTER_NAME: 't',
			GIT_COMMITTER_EMAIL: 't@example.com',
			GIT_CONFIG_NOSYSTEM: '1',
			GIT_CONFIG_GLOBAL: '/dev/null',
		},
	});
	if (r.status !== 0) {
		throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
	}
	return r.stdout.trim();
}

/** Lines of stderr that are GitHub `::error` annotations. */
export function errors(stderr: string): string[] {
	return stderr.split('\n').filter((l) => l.startsWith('::error'));
}
