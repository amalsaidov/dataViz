# Importing an external plugin repo with history preserved

Procedure used to pull `grafana/clock-panel` into this monorepo at
`packages/@plugins/grafana-clock-panel/`, preserving full upstream git history.

Method: `git filter-repo` (rewrite history into subdir, then merge with
`--allow-unrelated-histories`) rather than `git subtree add`. Chosen because it
produces clean per-commit path rewriting without subtree's merge-commit noise,
and doesn't couple us to `git subtree` for future maintenance.

## Prerequisites

```bash
brew install git-filter-repo
```

**Confirm the actual git repo root before picking the subdirectory prefix —
do not assume it equals your current working directory:**

```bash
git rev-parse --show-toplevel
```

This repo's cwd during dev is often `.../dataViz/plugins`, but the git repo
root is `.../dataViz` one level up. The `--to-subdirectory-filter` path must
be relative to the true repo root (e.g. `plugins/packages/@plugins/<name>`),
not relative to cwd. Getting this wrong silently lands the imported package
one directory too shallow (e.g. `./packages/@plugins/<name>` at the repo
root instead of `./plugins/packages/@plugins/<name>`) — caught by comparing
against an existing sibling package's real path, not by any error.

## Steps

1. Clone the source repo into a scratch location (outside this repo):
   ```bash
   git clone https://github.com/grafana/clock-panel /tmp/clock-panel
   ```

2. Rewrite all history in the clone so every path lives under the target
   subdirectory:
   ```bash
   cd /tmp/clock-panel
   git filter-repo --to-subdirectory-filter packages/@plugins/grafana-clock-panel
   ```

3. Back in this repo, add the rewritten clone as a temporary remote and fetch:
   ```bash
   git remote add clock-panel-src /tmp/clock-panel
   git fetch clock-panel-src
   ```

4. Merge histories without committing yet, so the result can be inspected:
   ```bash
   git merge --allow-unrelated-histories clock-panel-src/main --no-commit
   ```

5. Inspect staged result (`git status`, `git diff --cached`), resolve any
   conflicts, adjust the imported package to fit this repo's conventions
   (package.json name, tsconfig references, webpack config, wiring into root
   tsconfig / vitest aliases / docker-compose — see `CLAUDE.md` "Adding a new
   plugin package").

6. Once satisfied, commit the merge and remove the temporary remote:
   ```bash
   git commit
   git remote remove clock-panel-src
   ```

## Optional: preserving other upstream branches

`git fetch clock-panel-src` also pulls in every other branch from the source
repo (rewritten to the same subdirectory prefix) as remote-tracking refs
(`refs/remotes/clock-panel-src/*`) — not just `main`. Only `main` gets merged
in step 4. Removing the temp remote in step 6 deletes all those tracking
refs; any commits only reachable from them become unreachable and eventually
garbage-collected. They remain on the original upstream repo regardless —
this only affects what's kept locally/in this repo.

**Before removing the temp remote, prompt the user whether they want these
other branches preserved as local branches.** If yes:

```bash
for b in $(git for-each-ref --format='%(refname:short)' refs/remotes/clock-panel-src | grep -v HEAD); do
  name=${b#clock-panel-src/}
  git branch "clock-panel/$name" "$b"
done
```

(Prefixed `clock-panel/` to avoid collisions with existing branch names.)
Do this only on explicit confirmation — default is to let them be deleted
with the temp remote.

## Status

- [x] Confirmed target location: `packages/@plugins/grafana-clock-panel/`
- [x] Confirmed method: `git filter-repo`
- [x] Confirmed `git-filter-repo` installed (`/usr/local/bin/git-filter-repo`)
- [ ] Clone source repo
- [ ] Rewrite history to subdirectory
- [ ] Fetch + merge (no commit)
- [ ] Inspect + adapt to repo conventions
- [ ] Commit merge, clean up temp remote
