// Security invariants over every tracked workflow and composite action. These
// overlap zizmor on purpose: they run before push, in milliseconds. Untracked
// files are ignored, so scratch workflows in the working tree don't fail them.
//
// Line-based, not a YAML parser (node has none built in, and this suite adds
// no dependencies). It relies on the repo's two-space indentation.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { REPO } from './helpers.ts';

function tracked(...patterns: string[]): string[] {
	return execFileSync('git', ['ls-files', ...patterns], { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean);
}

const workflows = tracked('.github/workflows/*.yml', '.github/workflows/*.yaml');
const actions = tracked('.github/actions/*/action.yml', '.github/actions/*/action.yaml');

const indent = (line: string): number => line.length - line.trimStart().length;
const lines = (file: string): string[] => readFileSync(join(REPO, file), 'utf8').split('\n');

/** Every `run:` script as { line, text }, block scalars included. */
function runScripts(file: string): { line: number; text: string }[] {
	const ls = lines(file);
	const scripts: { line: number; text: string }[] = [];
	ls.forEach((l, i) => {
		const m = l.match(/^(\s*)(?:- )?run:\s*(.*)$/);
		if (!m) {
			return;
		}
		const keyIndent = indent(l);
		if (!/^[|>]/.test(m[2])) {
			scripts.push({ line: i + 1, text: m[2] });
			return;
		}
		const body: string[] = [];
		for (let j = i + 1; j < ls.length && (ls[j].trim() === '' || indent(ls[j]) > keyIndent); j++) {
			body.push(ls[j]);
		}
		scripts.push({ line: i + 1, text: body.join('\n') });
	});
	return scripts;
}

describe('workflows', () => {
	test('there are workflows to check', () => {
		assert.ok(workflows.length > 0);
	});

	for (const file of workflows) {
		describe(file, () => {
			test('top-level permissions: {}', () => {
				assert.ok(lines(file).includes('permissions: {}'), 'workflow must default the token to no permissions');
			});

			test('every job declares its own permissions', () => {
				const ls = lines(file);
				const start = ls.indexOf('jobs:');
				assert.ok(start >= 0);
				let job: string | undefined;
				const missing: string[] = [];
				let has = false;
				for (const l of [...ls.slice(start + 1), 'end:']) {
					if (/^\S/.test(l) || /^ {2}[\w-]+:\s*$/.test(l)) {
						if (job && !has) {
							missing.push(job);
						}
						job = /^ {2}([\w-]+):/.exec(l)?.[1];
						has = false;
						if (/^\S/.test(l)) {
							break;
						}
					} else if (/^ {4}permissions:/.test(l)) {
						has = true;
					}
				}
				assert.deepEqual(missing, []);
			});
		});
	}
});

describe('workflows and composite actions', () => {
	for (const file of [...workflows, ...actions]) {
		describe(file, () => {
			test('third-party uses: are pinned to a commit SHA with a # tag comment', () => {
				const bad = lines(file)
					.map((l, i): [number, string] => [i + 1, l.trim()])
					.filter(([, l]) => /^(- )?uses:/.test(l))
					.filter(([, l]) => !/uses: (\$|\.)\//.test(l))
					.filter(([, l]) => !/uses: [\w.-]+\/[\w./-]+@[0-9a-f]{40} # \S+/.test(l));
				assert.deepEqual(bad, []);
			});

			test('no ${{ }} expressions inside run: scripts', () => {
				const bad = runScripts(file)
					.filter((s) => s.text.includes('${{'))
					.map((s) => `line ${s.line}`);
				assert.deepEqual(bad, [], 'pass values through env: instead');
			});
		});
	}
});
