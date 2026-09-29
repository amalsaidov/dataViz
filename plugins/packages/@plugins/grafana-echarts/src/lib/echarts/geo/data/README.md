# Basemap data

`countries.json` is a copy of
[`public/maps/countries.geojson`](https://github.com/grafana/grafana/blob/main/public/maps/countries.geojson) in
`grafana/grafana`. The file is not changed (it is in `.prettierignore` for this reason). The file extension is
`.json`, so that webpack and TypeScript load it as JSON.

License: Grafana is AGPL-3.0, and this repository is AGPL-3.0-only (see `LICENSE`). Thus the copy is allowed.

Only the geo panel loads this file, from an async chunk (see `src/modules/geo/module.tsx`). Do not import it
from a file that the other panels import.
