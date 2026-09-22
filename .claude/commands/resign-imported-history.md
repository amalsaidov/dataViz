# Re-signing imported plugin history for signed-commit branch protection

Follow-up procedure to `import-external-plugin.md`. This repo's branch
protection requires all commits to have GitHub-verified signatures. An
imported external repo's history (e.g. `grafana-clock-panel` from
`grafana/clock-panel`) is almost never signed, so `git push` on the import
branch will be rejected with:

```
remote: error: GH013: Repository rule violations found for refs/heads/<branch>.
remote: - Commits must have verified signatures.
remote:   Found <N> violations (showing first 10): ...
! [remote rejected] <branch> -> <branch> (push declined due to repository rule violations)
```

This happens even after `git commit --no-edit` on the merge itself (that one
commit gets signed since it's yours), because the hundreds of upstream
commits in the merged-in history remain unsigned.

## Why a plain rebase doesn't work

Two tempting fixes both fail:

1. **`git rebase -S main`** (no `--rebase-merges`) — linearizes history,
   replaying every individual upstream commit against `main` one at a time.
   This causes spurious conflicts unrelated to the actual merge (e.g. an
   upstream commit from years ago touching `package.json` conflicts with
   `main`'s current `package.json`), because commits that were never
   individually applied against `main` are now being forced through it.

2. **`git rebase -S --rebase-merges main`** — preserves merge topology, but
   without `--force-rebase` it's a no-op if `main` is already an ancestor of
   the branch (nothing to do, so nothing gets re-signed — same commit hashes
   come out). Adding `--force-rebase` makes it actually replay, but then it
   tries to *recreate* every merge commit in the imported history by
   redoing the merge algorithm — which fails whenever the original merge
   involved manual conflict resolution that doesn't match what a fresh
   auto-merge produces (e.g. old `yarn.lock`/`package.json` merge conflicts
   from the upstream project's own history).

Both approaches try to **re-derive** trees from diffs. What's actually
needed is to **copy** each commit's existing tree unchanged and just
re-parent + re-sign it — never re-run a merge or diff apply.

## The fix: `commit-tree` walk

Walk every commit in the imported range in topological order (parents
before children), and for each one create a brand new commit object with
`git commit-tree` that:

- points at the **exact same tree** as the original commit (no diffing, so
  it's impossible to conflict)
- re-parents onto the **already-remapped** new parent(s) (or the original
  parent if it's outside the range, e.g. `main` itself)
- preserves the original **author** name/email/date (for attribution)
- overrides the **committer** to your own name/email (see gotcha below)
- is signed (`commit-tree -S`)

Then move the branch ref to the last remapped commit.

### Gotcha: committer email must match your key/account, not the original committer

The first pass of this script preserved the *original* committer
identity (e.g. the upstream maintainer's email) on every re-signed
commit. That produced a valid GPG signature, but GitHub still reported
every commit as unverified — GitHub's "Verified" check requires the
**committer** email in the commit to match an email tied to the
signing key/your GitHub account. Signing with your key but leaving a
stranger's email in the committer field doesn't satisfy that. Fix:
override `GIT_COMMITTER_NAME`/`GIT_COMMITTER_EMAIL` to your own
identity (author stays untouched), keep the original committer *date*.

## Script

```bash
#!/bin/bash
set -euo pipefail

# Usage: resign.sh <base-branch> <head-ref-to-resign>
# Prints NEW_HEAD=<sha>; move your branch ref to it and force-push.

BASE="${1:?base branch, e.g. main}"
HEAD_REF="${2:?ref/sha to resign, e.g. task/pull-in-clock-panel}"

MY_NAME=$(git config --get user.name)
MY_EMAIL=$(git config --get user.email)

declare -A map

commits=$(git rev-list --topo-order --reverse --parents "${BASE}..${HEAD_REF}")

while read -r line; do
  old=$(echo "$line" | awk '{print $1}')
  parents=$(echo "$line" | awk '{$1=""; print $0}')

  new_parent_args=()
  for p in $parents; do
    if [[ -n "${map[$p]:-}" ]]; then
      new_parent_args+=(-p "${map[$p]}")
    else
      new_parent_args+=(-p "$p")
    fi
  done

  tree=$(git rev-parse "${old}^{tree}")

  IFS=$'\x01' read -r an ae ad cd < <(git show -s --format='%an%x01%ae%x01%ad%x01%cd' --date=raw "$old")

  msgfile=$(mktemp)
  git show -s --format=%B "$old" > "$msgfile"

  new=$(GIT_AUTHOR_NAME="$an" GIT_AUTHOR_EMAIL="$ae" GIT_AUTHOR_DATE="$ad" \
        GIT_COMMITTER_NAME="$MY_NAME" GIT_COMMITTER_EMAIL="$MY_EMAIL" GIT_COMMITTER_DATE="$cd" \
        git commit-tree -S "$tree" "${new_parent_args[@]}" -F "$msgfile")

  rm -f "$msgfile"
  map[$old]=$new
done <<< "$commits"

last_old=$(echo "$commits" | tail -1 | awk '{print $1}')
echo "NEW_HEAD=${map[$last_old]}"
```

## Steps

1. Confirm signing is set up: `git config --get user.signingkey`,
   `git config --get commit.gpgsign` should be `true`, and
   `gpg --list-secret-keys --keyid-format LONG <key-id>` should show a
   `uid` matching your `user.email`.

2. Run the script against the already-committed import merge:
   ```bash
   bash resign.sh main task/pull-in-clock-panel
   # NEW_HEAD=<sha>
   ```

3. Verify before touching the branch:
   ```bash
   # tree/content must be byte-identical to the pre-resign branch
   git diff task/pull-in-clock-panel <NEW_HEAD> --stat   # expect empty

   # commit count must match
   git rev-list --count main..<NEW_HEAD>
   git rev-list --count main..task/pull-in-clock-panel

   # every commit in range must verify
   git rev-list main..<NEW_HEAD> | while read c; do
     git verify-commit "$c" 2>/dev/null || echo "FAIL: $c"
   done | wc -l   # expect 0
   ```

4. Move the branch and push:
   ```bash
   git reset --hard <NEW_HEAD>   # if currently checked out on the branch
   # or: git branch -f task/pull-in-clock-panel <NEW_HEAD>   # if not checked out
   git push -u origin task/pull-in-clock-panel
   ```

## Notes

- This rewrites every commit hash in the imported range. Fine pre-push;
  if the branch was already pushed, this is a force-push and anyone else
  with the branch checked out needs to reset to the new history.
- Original upstream commit history is untouched on the actual upstream
  repo (e.g. `grafana/clock-panel`) — this only affects the copy living
  in this monorepo's branch.
- The whole walk (~530 commits) takes about a minute locally; each
  `commit-tree -S` call shells out to `gpg`.
