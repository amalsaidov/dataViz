import { PanelPlugin } from '@grafana/data';
import { type EChartsFieldConfig } from 'editor/types';
import { makeLazyPanel } from 'lib/components/LazyPanel';
import { STANDARD_FIELD_OPTIONS } from 'lib/grafana/editor/common/fieldConfig';
import { type PanelOptions } from 'types';
import { geoSuggestionsSupplier } from './suggestions';

// Geo family panel: markers on a map, placed with the location matchers of core Geomap
// (see `lib/grafana/geo/location.ts`). This scaffold has no options and draws no map yet;
// the basemap and the markers are added by the next issues of epic #29.
export const plugin = new PanelPlugin<PanelOptions, EChartsFieldConfig>(makeLazyPanel('geo'))
  .useFieldConfig({ standardOptions: STANDARD_FIELD_OPTIONS })
  // Advertise fitness for data with lat/lon, geohash or lookup fields (opts in via `"suggestions": true`).
  .setSuggestionsSupplier(geoSuggestionsSupplier);
