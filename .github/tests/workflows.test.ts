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
	test('finds tracked workflows to check', () => {
		assert.ok(workflows.length > 0);
	});

	for (const file of workflows) {
		describe(file, () => {
			test('defaults the token to no permissions (top-level permissions: {})', () => {
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

/** Each job under `jobs:` as { name, lines }, keyed by two-space indentation. */
function jobs(file: string): { name: string; lines: string[] }[] {
	const ls = lines(file);
	const out: { name: string; lines: string[] }[] = [];
	const start = ls.indexOf('jobs:');
	for (const l of ls.slice(start + 1)) {
		if (/^\S/.test(l)) {
			break;
		}
		const m = /^ {2}([\w-]+):\s*$/.exec(l);
		if (m) {
			out.push({ name: m[1], lines: [] });
		} else if (out.length > 0) {
			out[out.length - 1].lines.push(l);
		}
	}
	return out;
}

/** A job's steps, each as the lines from its `- ` to the next one. */
function steps(jobLines: string[]): string[][] {
	const out: string[][] = [];
	let inSteps = false;
	for (const l of jobLines) {
		if (/^ {4}steps:/.test(l)) {
			inSteps = true;
		} else if (/^ {4}\S/.test(l)) {
			inSteps = false;
		} else if (inSteps && /^ {6}- /.test(l)) {
			out.push([l]);
		} else if (inSteps && out.length > 0) {
			out[out.length - 1].push(l);
		}
	}
	return out;
}

// Jobs that can write to the PR must not execute anything the PR controls:
// no checkout of this repo, no package-manager or Node commands, no repo
// scripts, and no reusable-workflow calls. They may only read artifacts that
// a read-only job produced, and check out pinned third-party code.
describe('PR write tokens never run PR code', () => {
	const runsPrCode = /\b(pnpm|npm|npx|yarn|node)\b|\.github\/(scripts|actions)\//;

	for (const file of workflows) {
		for (const job of jobs(file).filter((j) => j.lines.some((l) => /^ {6}pull-requests:\s*write/.test(l)))) {
			test(`${file}: ${job.name}`, () => {
				assert.ok(!job.lines.some((l) => /^ {4}uses:/.test(l)), 'calls a reusable workflow');
				for (const step of steps(job.lines)) {
					const text = step.join('\n');
					if (/uses: actions\/checkout@/.test(text)) {
						assert.match(text, /^\s+repository:/m, `checks out this repo:\n${text}`);
					}
					const run = text.match(/run:\s*([\s\S]*)/)?.[1] ?? '';
					assert.doesNotMatch(run, runsPrCode, `runs repo or package code:\n${text}`);
				}
			});
		}
	}

	test('covers both comment-posting report jobs', () => {
		const guarded = workflows.flatMap((f) =>
			jobs(f)
				.filter((j) => j.lines.some((l) => /^ {6}pull-requests:\s*write/.test(l)))
				.map((j) => `${f}:${j.name}`)
		);
		// Others (e.g. stale.yml's scheduled jobs) are guarded too; these two
		// must be, or the job splitting above has stopped matching them.
		for (const job of ['.github/workflows/plugin-bundle-stats.yml:report', '.github/workflows/plugin-ci.yml:compatibility-report']) {
			assert.ok(guarded.includes(job), `${job} is not guarded`);
		}
	});
});
