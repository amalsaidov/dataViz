# Repo migration leftovers

## Status

The package moved from `gtk-grafana/grafana-echarts` into `grafana/dataViz`. The READMEs and both shipped `plugin.json` files now link to `grafana/dataViz`. The items below still refer to the old repository, or were not moved.

## Release impact

None of these items is a release gate. No item ships in a plugin archive.

## References to `gtk-grafana`

These three references are not links into the old repository, so the README link change did not replace them.

| File                                                   | Reference                                                              | What it is                                                                                            | Action                                                                                                                |
| ------------------------------------------------------ | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `todo/echarts_panel_type_research_2bc0fc1a.plan.md:37` | `gtk-grafana/grafana-echarts/issues/7`                                 | Old-repo issue "Refactor panel types". The issue is closed. Issues did not move with the import.      | Remove the link, or replace it with the issue title.                                                                  |
| `docs/dataset.md:7`                                    | `gtk-grafana/performance-options`                                      | Old-repo branch that held the `dataset` prototype. The branch no longer exists in the old repository. | Replace the branch name with commit `bea4db2` (prototype) and commit `7992856` (revert). Both are in this repository. |
| `src/lib/components/hooks/useSeriesVisibility.ts:38`   | `grafana/grafana/compare/gtk-grafana/onFieldConfigChange/broken-types` | A branch in `grafana/grafana`, not in the old repository.                                             | Keep. The `@todo` stays valid until that change merges.                                                               |

## Workflows not moved

The package's nested `.github/` was removed. `echarts-ci.yml` and `echarts-bundle-stats.yml` at the repo root replace the CI, e2e, compatibility and bundle-size workflows. Two workflows have no replacement:

- **`release.yml`**: signs and validates the standalone Relations archive on a `v*` tag. Before you move it, decide:
  - a tag name that is specific to the plugin, because other plugins in this repository also use tags
  - the `GRAFANA_ACCESS_POLICY_TOKEN` secret for this repository
  - whether Grafana's shared plugin CD workflow (`grafana/plugin-ci-workflows`) replaces it
- **`cp-update.yml`**: runs `grafana/plugin-actions/create-plugin-update` each month. That action reads `.config/.cprc.json` at the repo root, so it cannot update a plugin in a subdirectory. It also needs a `GH_PAT_TOKEN` secret. To update the scaffold, run `npx @grafana/create-plugin@latest update` in this package.

To get the upstream files, run `git show dd8e133:plugins/packages/@plugins/grafana-echarts/.github/workflows/release.yml` (or `cp-update.yml`).
