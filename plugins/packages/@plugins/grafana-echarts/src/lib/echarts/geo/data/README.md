# Basemap data

`countries.geojson` is a copy of
[`public/maps/countries.geojson`](https://github.com/grafana/grafana/blob/main/public/maps/countries.geojson) in
`grafana/grafana`. The file is not changed (it is in `.prettierignore` for this reason). No code imports it. It is
the source of `countries.topo.json`.

`countries.topo.json` is the basemap that the geo panel loads. `scripts/build-basemap.mjs` writes it from
`countries.geojson`:

1. It changes the GeoJSON to [TopoJSON](https://github.com/topojson/topojson-specification). Adjacent countries share
   one border arc.
2. It simplifies the arcs with a tolerance of 0.1 degree (a minimum triangle area of 0.01 square degrees).
3. It quantizes the positions to a grid of 1e4 steps on each axis (about 4 km at the equator).

The file is 92,460 bytes. A minimum weight of 0.1 square degrees gives 76,641 bytes, with less detail. That value is
the Phase 2 fallback if the standalone bundle needs the bytes.

If `countries.geojson` changes, run `node scripts/build-basemap.mjs` and commit the two files. Issue #340 gives the
sizes that caused this encoding.

License: Grafana is AGPL-3.0, and this repository is AGPL-3.0-only (see `LICENSE`). Thus the copy is allowed.
`topojson-client` decodes the file in the browser. Its license is ISC. The license comment in `basemap.ts` puts its
notice in `geo-basemap.js.LICENSE.txt`.

Only the geo panel loads the basemap, from an async chunk (see `src/modules/geo/module.tsx`). Do not import
`basemap.ts` or the data files from a file that the other panels import.
