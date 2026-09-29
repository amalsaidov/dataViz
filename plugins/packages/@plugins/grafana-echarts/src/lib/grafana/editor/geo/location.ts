import { type Field, FieldType, type PanelOptionsEditorBuilder } from '@grafana/data';
import { type FrameGeometrySource, FrameGeometrySourceMode, type MapLayerOptions } from '@grafana/schema';
import { COUNTRIES_GAZETTEER_PATH, USA_STATES_GAZETTEER_PATH } from 'lib/grafana/geo/gazetteer';

/** The location modes that `lib/grafana/geo/location.ts` reads. Core also has H3 and WKT (#384). */
const LOCATION_MODES = [
  { value: FrameGeometrySourceMode.Auto, label: 'Auto' },
  { value: FrameGeometrySourceMode.Coords, label: 'Coords' },
  { value: FrameGeometrySourceMode.Geohash, label: 'Geohash' },
  { value: FrameGeometrySourceMode.Lookup, label: 'Lookup' },
];

/** The bundled gazetteers. Core also loads `airports.geojson` and custom URLs from the Grafana server. */
const GAZETTEERS = [
  {
    value: COUNTRIES_GAZETTEER_PATH,
    label: 'Countries',
    description: 'Lookup countries by name, two letter code, or three letter code',
  },
  { value: USA_STATES_GAZETTEER_PATH, label: 'USA States', description: 'Lookup states by name or 2-letter code' },
];

const numberField = (f: Field) => f.type === FieldType.number;
const stringField = (f: Field) => f.type === FieldType.string;

/**
 * The location options of a layer, as core `addLocationFields`: the mode, then the fields of that mode.
 * The paths start at the layer (`location.*`).
 * https://github.com/grafana/grafana/blob/main/public/app/features/geo/editor/locationEditor.ts
 * https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/geomap/#location-mode
 */
export function addLocationFields(
  builder: PanelOptionsEditorBuilder<MapLayerOptions>,
  source: FrameGeometrySource | undefined
): void {
  // Core `LocationModeEditor` is a select of the modes.
  builder.addSelect({
    path: 'location.mode',
    name: 'Location Mode',
    settings: { options: LOCATION_MODES },
  });

  switch (source?.mode) {
    case FrameGeometrySourceMode.Coords:
      builder
        .addFieldNamePicker({
          path: 'location.latitude',
          name: 'Latitude field',
          settings: { filter: numberField, noFieldsMessage: 'No numeric fields found' },
        })
        .addFieldNamePicker({
          path: 'location.longitude',
          name: 'Longitude field',
          settings: { filter: numberField, noFieldsMessage: 'No numeric fields found' },
        });
      break;
    case FrameGeometrySourceMode.Geohash:
      builder.addFieldNamePicker({
        path: 'location.geohash',
        name: 'Geohash field',
        settings: { filter: stringField, noFieldsMessage: 'No strings fields found' },
      });
      break;
    case FrameGeometrySourceMode.Lookup:
      builder
        .addFieldNamePicker({
          path: 'location.lookup',
          name: 'Lookup field',
          settings: { filter: stringField, noFieldsMessage: 'No strings fields found' },
        })
        .addSelect({
          path: 'location.gazetteer',
          name: 'Gazetteer',
          settings: { options: GAZETTEERS },
        });
      break;
  }
}
