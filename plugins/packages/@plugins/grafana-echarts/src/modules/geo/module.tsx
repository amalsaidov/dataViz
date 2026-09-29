import { PanelPlugin } from '@grafana/data';
import { type EChartsFieldConfig } from 'editor/types';
import { makeLazyPanel } from 'lib/components/LazyPanel';
import { STANDARD_FIELD_OPTIONS } from 'lib/grafana/editor/common/fieldConfig';
import { type PanelOptions } from 'types';
import { geoSuggestionsSupplier } from './suggestions';

// Loads and registers the basemap before the first render. The async chunk keeps the basemap data out of this
// entry and out of the other panels. A failed load draws no basemap, and it does not stop the panel.
const loadBasemap = () =>
  // The chunk name is `GEO_BASEMAP_CHUNK` of `webpack.config.ts`.
  import(/* webpackChunkName: "geo-basemap" */ 'lib/echarts/geo/basemap').then(
    (m) => m.registerBasemap(),
    () => undefined
  );

// Geo family panel: markers on a map, placed with the location matchers of core Geomap
// (see `lib/grafana/geo/location.ts`). This scaffold has no options and draws no map yet;
// the markers are added by the next issue of epic #29 (#362).
export const plugin = new PanelPlugin<PanelOptions, EChartsFieldConfig>(makeLazyPanel('geo', loadBasemap))
  .useFieldConfig({ standardOptions: STANDARD_FIELD_OPTIONS })
  // Advertise fitness for data with lat/lon, geohash or lookup fields (opts in via `"suggestions": true`).
  .setSuggestionsSupplier(geoSuggestionsSupplier);
