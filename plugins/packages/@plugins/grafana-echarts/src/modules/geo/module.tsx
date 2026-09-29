import { PanelPlugin } from '@grafana/data';
import { type EChartsFieldConfig } from 'editor/types';
import { makeLazyPanel } from 'lib/components/LazyPanel';
import { STANDARD_FIELD_OPTIONS } from 'lib/grafana/editor/common/fieldConfig';
import { type PanelOptions } from 'types';
import { geoSuggestionsSupplier } from './suggestions';

// Loads and registers the basemap and the marker option builder before the first render. The async chunk keeps
// the basemap data out of this entry and out of the other panels. A failed load draws nothing, and it does not
// stop the panel.
const loadBasemap = () =>
  // The chunk name is `GEO_BASEMAP_CHUNK` of `webpack.config.ts`.
  import(/* webpackChunkName: "geo-basemap" */ 'lib/echarts/geo/chart').then(
    (m) => m.registerGeoChart(),
    () => undefined
  );

// Geo family panel: markers of one fixed style on a vector basemap, placed with the location matchers of core
// Geomap (see `lib/grafana/geo/location.ts`). It reads the core `view` and `layers` options from the panel JSON;
// it has no editor for them yet (#330).
export const plugin = new PanelPlugin<PanelOptions, EChartsFieldConfig>(makeLazyPanel('geo', loadBasemap))
  .useFieldConfig({ standardOptions: STANDARD_FIELD_OPTIONS })
  // Advertise fitness for data with lat/lon, geohash or lookup fields (opts in via `"suggestions": true`).
  .setSuggestionsSupplier(geoSuggestionsSupplier);
