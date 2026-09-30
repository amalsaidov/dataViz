# i18n CI

How strings move between this monorepo and Crowdin, and why it is built the way it is.

| workflow | trigger | does |
|---|---|---|
| `i18n-verify.yml` | PR, push to main | Fails if a package's extracted `en-US` strings are not committed |
| `i18n-crowdin-upload.yml` | push to main touching `en-US` files | Sends new source strings to Crowdin |
| `i18n-crowdin-download.yml` | Mondays, or manual | Opens one PR per Crowdin project with finished translations |
| `i18n-crowdin-create-tasks.yml` | 1st of the month, or manual | Assigns pending strings to translators |

None of them names a plugin. Every workflow asks `discover-i18n-packages` what exists.

## Opting a package in

A package opts in by having a `crowdin.yml`. It also needs:

1. An `i18n-extract:ci` script in `package.json`.
2. `x_dataviz.crowdin_project_id` in `crowdin.yml`.
3. A Crowdin token in Vault at the path described under [Secrets](#secrets).

No workflow edits are needed.

`x_dataviz` holds CI metadata. crowdin-cli ignores it, and the workflows strip it before handing the file to the CLI.

| key | default | meaning |
|---|---|---|
| `crowdin_project_id` | required | Crowdin project |
| `vault_secret_path` | `<plugin id>-crowdin-token` | Vault path suffix |
| `vault_secret_key` | `access_token` | key within that secret |
| `github_board_id` | `76` | project board for translation PRs |
| `pr_labels` | `i18n` | comma-separated labels for translation PRs |
| `plugins` | derived | only for packages that publish several plugins, see below |

## Packages and plugins

Crowdin work runs per **published plugin**. Extraction runs per **workspace package**. They differ for packages that publish more than one plugin, so `discover` emits two matrices: `plugins` for upload, download, and create-tasks, and `packages` for verify.

**Single-plugin package** (clock-panel). Declare only `crowdin_project_id`. The plugin id comes from `src/plugin.json`, and every `files[].source` belongs to it.

**Container package** (grafana-echarts). One directory builds several plugins: `src/plugin.json` is the app, each `src/modules/*/plugin.json` is a panel, and a standalone build such as Relations registers under its own plugin id. `initPluginTranslations` resolves translations by plugin id, so each published plugin needs its own namespace file.

The default is **one Crowdin project per package, with one `files[]` entry per published plugin**:

```yaml
x_dataviz:
  crowdin_project_id: 'NN'
files:
  - source: src/locales/en-US/grafana-echarts-app.json
    translation: src/locales/%locale%/%original_file_name%
  - source: src/locales/en-US/grafana-relations-panel.json
    translation: src/locales/%locale%/%original_file_name%
```

Most of a container package's strings come from shared code. In grafana-echarts, 19 of 21 `t()` calls are in `src/lib`, which compiles into every build. Crowdin can link identical strings within one project (the "Duplicate strings" project setting), but not across projects. Separate projects would mean translating each shared string once per plugin per locale.

Split into separate projects only when plugins have disjoint strings or different owning teams. Declare each plugin and its sources, because which strings belong to which project can't be derived from the tree:

```yaml
x_dataviz:
  plugins:
    - id: grafana-echarts-app
      crowdin_project_id: 'NN'
      sources: ['src/locales/en-US/grafana-echarts-app.json']
    - id: grafana-relations-panel
      crowdin_project_id: 'MM'
      sources: ['src/locales/en-US/grafana-relations-panel.json']
```

Two entries can't share a project id. For one project, use the single-entry form above.

### What discover rejects

Each of these would otherwise fail quietly or confusingly later:

- `crowdin.yml` with no `i18n-extract:ci` script. `pnpm --filter` exits 0 on a missing script, so the verify job would pass without checking anything.
- A plugin id that is not `^[a-z0-9][a-z0-9-]*$`. It becomes a branch name and a Vault path.
- A plugin with no `crowdin_project_id`, or with no sources.
- A plugin listing a source that isn't in `files[]`. The job would upload nothing.
- A `files[]` source that belongs to no plugin. Those strings would never reach translators.
- Two plugins sharing an id, a project id, or a Vault path. These cause, in that order: two jobs force-pushing one branch, two `base_path`s writing into one project, and both plugins reading one token that opens only one project.

## Secrets

Each plugin has its own Crowdin token, because Crowdin tokens are scoped to one project. The Vault path is:

```
ci/data/repo/grafana/dataViz/<plugin id>-crowdin-token     key: access_token
```

In the Vault UI you type `repo/grafana/dataViz/...` into the `ci` secrets engine; KV v2 adds `data/`. The repo segment comes from `github.repository` and can't be configured.

Other Grafana repos use the name `grafana-frontend-crowdin-token`. That name identifies the Crowdin bot account's owning team, not a project, so it can't tell several plugins apart here.

Tokens come from the `grafana-frontend-platform-crowdin-bot` Crowdin account (Frontend Platform 1Password vault), per [`deployment_tools/docs/grafana-frontend/plugin-internationalization.md`](https://github.com/grafana/deployment_tools/blob/main/docs/grafana-frontend/plugin-internationalization.md). Engineers can write to `ci/repo/` but can't read it back, so do anything that needs the token locally before storing it.

There's deliberately no fallback for a missing secret. `get-vault-secrets` fails loudly instead of using `ignore_missing`, because a silently skipped sync is how clock-panel's locales went stale after the import.

The token reaches the Crowdin actions through `fromJSON(steps.vault-secrets.outputs.secrets)`, not `env`. `get-vault-secrets` sets `exportEnv: false`, so reading it from `env` silently passes an empty string.

## Design decisions

**The download action is local.** `grafana/grafana-github-actions/crowdin-download` hardcodes the branch `i18n_crowdin_translations` in every place it does git work, and has no input to change it. With several plugins, every matrix job would build from main and force-push the same ref, so only the last job's translations would survive. Running the jobs one at a time doesn't help, because the overwrite is then deterministic. `crowdin-download/` takes a `localization_branch_name`, and the workflow passes `i18n_crowdin_translations_<plugin id>`. Upload and create-tasks still use the upstream actions, which have no git involvement.

**A root `crowdin.yml` is generated per job.** The upstream Crowdin actions read `crowdin.yml` from the workspace root and have no config-path input. Each job writes one from the package's config, with `base_path` set to the package directory and `files[]` filtered to that plugin's sources. Setting `base_path`, rather than rewriting `source:` to repo-root paths, is what keeps remote paths unchanged: with `preserve_hierarchy: true`, Crowdin computes remote paths relative to `base_path`. Rewriting `source:` would move every file in the Crowdin project and orphan its translations. `/crowdin.yml` is gitignored, so the generated file never appears in a commit.

**Translation PRs are opened from same-repo branches only.** A head-branch lookup also matches PRs from forks, so the action filters on `isCrossRepository == false`. Without that, a fork with a branch of the same name would be treated as the translation PR.

**Commits go through the GitHub API.** The Signed Commits ruleset rejects unsigned commits. Commits made through the API with the `grafana-pr-automation` App token are signed.

**Automerge is off.** The action supports it, but it needs `github_pr_approver_token`, which isn't supplied, so translation PRs get a human review. Upstream clock-panel never enabled it either.

**Upload only touches what changed.** On a push, upload narrows to plugins whose `en-US` files changed, using the compare API so the shallow sparse checkout is enough. Anything else (manual dispatch, a new branch, a rewritten range) uploads every plugin, since doing too much work is the safe failure.

**Local actions use `$/`.** `$/.github/actions/...` is resolved by the runner from this repo at the workflow's ref, so it needs no checkout and can't be swapped out by an earlier step. zizmor requires it. actionlint doesn't understand it yet (rhysd/actionlint#711), so `.github/actionlint.yaml` suppresses that one message.

## Crowdin CLI 5

The download action uses `crowdin/github-action` v3, which runs Crowdin CLI 5. Grafana's other callers are on v2. Before moving, these were checked: the action's `download_translations()` is unchanged between v2.7.0 and v3.3.0; no inputs were removed; the new `user` input defaults to v2's behavior; and `crowdin config lint` passes on the generated config.

What that doesn't prove is that remote paths are computed the same way, which needs a live project. Before changing that pin again, generate the root config as the workflow does and diff the two CLI versions:

```bash
for v in 4.7.0 5.3.0; do
  docker run --rm -v "$PWD:/w" -w /w -e CROWDIN_PROJECT_ID=<id> -e CROWDIN_PERSONAL_TOKEN="$TOKEN" \
    "crowdin/cli:$v" crowdin config translations -c crowdin.yml > "/tmp/paths-$v.txt"
done
diff /tmp/paths-4.7.0.txt /tmp/paths-5.3.0.txt
```
