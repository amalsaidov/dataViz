// The vector basemap of the geo panel: the country shapes of core `public/maps/countries.geojson`, as quantized
// TopoJSON (see `data/README.md`). Only the geo panel imports this file, from an async chunk. Thus the other panels
// and the standalone viz bundle do not get the data, the decoder or `GeoComponent`.
import { LinesChart } from 'echarts/charts';
import { GeoComponent } from 'echarts/components';
// `use` is aliased as in `lib/echarts/echarts.ts`, for the react-hooks lint rule.
import { registerMap, use as registerEChartsModules } from 'echarts/core';
import { feature } from 'topojson-client';
import countries from './data/countries.topo.json';

/** The map name for `geo.map`. https://echarts.apache.org/en/option.html#geo.map */
export const BASEMAP_NAME = 'grafana-countries';

/** The TopoJSON object name. `scripts/build-basemap.mjs` writes the same name. */
const OBJECT_NAME = 'countries';

type MapSource = Parameters<typeof registerMap>[1];
/** The TopoJSON type of `topojson-specification`, from the `feature` signature. */
type Topology = Parameters<typeof feature>[0];

/** The JSON import types `type` as `string`; the check gives the TopoJSON type of `feature`. */
function isTopology(data: object): data is Topology {
  return 'type' in data && data.type === 'Topology' && 'objects' in data && 'arcs' in data;
}

/** The JSON import types `type` as `string`; the check gives the GeoJSON type of `registerMap`. */
function isFeatureCollection(data: object): data is Exclude<MapSource, string> {
  return 'type' in data && data.type === 'FeatureCollection' && 'features' in data && Array.isArray(data.features);
}

// The legal comment gives the notice of `topojson-client` to the license file of the chunk.
/*!
 * topojson-client 3.1.0 https://github.com/topojson/topojson-client (ISC License)
 *
 * Copyright 2012-2019 Michael Bostock
 *
 * Permission to use, copy, modify, and/or distribute this software for any purpose
 * with or without fee is hereby granted, provided that the above copyright notice
 * and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
 * REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
 * FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
 * INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
 * OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
 * TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
 * THIS SOFTWARE.
 */

/**
 * Decode the TopoJSON basemap to a GeoJSON feature collection.
 * https://github.com/topojson/topojson-client#feature
 */
function decodeBasemap(): object | undefined {
  const data: object = countries;
  return isTopology(data) ? feature(data, data.objects[OBJECT_NAME]) : undefined;
}

/**
 * Register the `geo` coordinate system, the `lines` series of the route layer and the basemap with ECharts. A second
 * call has no new effect.
 * https://echarts.apache.org/handbook/en/basics/import (import by parts)
 * https://echarts.apache.org/en/api.html#echarts.registerMap
 */
export function registerBasemap(): void {
  registerEChartsModules([GeoComponent, LinesChart]);
  const map = decodeBasemap();
  if (map && isFeatureCollection(map)) {
    registerMap(BASEMAP_NAME, map);
  }
}
