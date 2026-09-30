import { FieldConfigProperty, PanelPlugin } from '@grafana/data';
import { type EChartsFieldConfig } from 'editor/types';
import { makeLazyPanel } from 'lib/components/LazyPanel';
import { STANDARD_FILTERABLE_OPTION } from 'lib/grafana/editor/common/fieldConfig';
import { addGeoControlsOptions } from 'lib/grafana/editor/geo/controls';
import { addGeoLayerOptions } from 'lib/grafana/editor/geo/layers';
import { addGeoViewOptions } from 'lib/grafana/editor/geo/view';
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

// Geo family panel: the markers of the core Geomap markers layer on a vector basemap, placed with the location
// matchers of core Geomap (see `lib/grafana/geo/location.ts`). It reads the core `view` and `layers` options. The
// editor has the map view (first, as core), the layer list, the location and style options of each layer and the
// map controls.
export const plugin = new PanelPlugin<PanelOptions, EChartsFieldConfig>(makeLazyPanel('geo', loadBasemap))
  // The standard Color option of Grafana, as core Geomap: the Thresholds mode is the default. A marker color from a
  // field uses it. https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/module.tsx
  .useFieldConfig({ standardOptions: { [FieldConfigProperty.Filterable]: STANDARD_FILTERABLE_OPTION } })
  .setPanelOptions((builder, context) => {
    addGeoLayerOptions(addGeoViewOptions(builder), context.options);
    addGeoControlsOptions(builder);
  })
  // Advertise fitness for data with lat/lon, geohash or lookup fields (opts in via `"suggestions": true`).
  .setSuggestionsSupplier(geoSuggestionsSupplier);
