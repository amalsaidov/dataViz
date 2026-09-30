import { type StandardEditorProps } from '@grafana/data';
import { type MapViewConfig } from '@grafana/schema/dist/esm/raw/composable/geomap/panelcfg/x/GeomapPanelCfg_types.gen';
import { Button, Combobox, InlineField, Stack } from '@grafana/ui';
import React from 'react';
import { type GeoInstanceState } from 'lib/grafana/geo/view';
import { GeoFixedNumberInput } from './GeoFixedNumberInput';
import {
  applyCurrentMapView,
  getMapViewFields,
  MAP_VIEW_OPTIONS,
  resolveMapView,
  selectMapViewPreset,
  ZOOM_LIMIT_RANGE,
  ZOOM_RANGE,
} from './mapView';

const labelWidth = 14;

/**
 * The view editor of core Geomap: the preset select, lat and lon for "Coordinates", the padding for
 * "Fit to data", the zoom and its limits, then the button that saves the live view of the panel.
 * Core: https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/editor/MapViewEditor.tsx
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/inputs-combobox--docs
 */
export const GeoMapViewEditor = ({
  value,
  onChange,
  context,
}: StandardEditorProps<MapViewConfig, unknown, unknown, GeoInstanceState>) => {
  const view = resolveMapView(value);
  const fields = getMapViewFields(view);
  const set = (patch: Partial<MapViewConfig>) => onChange({ ...view, ...patch });
  return (
    <Stack direction="column" gap={0.5}>
      <InlineField label="View" labelWidth={labelWidth} grow>
        <Combobox<string>
          aria-label="View"
          options={MAP_VIEW_OPTIONS}
          value={view.id ?? null}
          onChange={(o) => o && onChange(selectMapViewPreset(view, o.value))}
        />
      </InlineField>
      {fields.coords && (
        <>
          <InlineField label="Latitude" labelWidth={labelWidth} grow>
            <GeoFixedNumberInput
              aria-label="Latitude"
              value={view.lat}
              min={-90}
              max={90}
              onChange={(lat) => set({ lat })}
            />
          </InlineField>
          <InlineField label="Longitude" labelWidth={labelWidth} grow>
            <GeoFixedNumberInput
              aria-label="Longitude"
              value={view.lon}
              min={-180}
              max={180}
              onChange={(lon) => set({ lon })}
            />
          </InlineField>
        </>
      )}
      {fields.padding && (
        <InlineField label="Padding" labelWidth={labelWidth} grow tooltip="Space around the data, in percent">
          <GeoFixedNumberInput
            aria-label="Padding"
            value={view.padding ?? 5}
            min={0}
            max={Infinity}
            onChange={(padding) => set({ padding })}
          />
        </InlineField>
      )}
      {/* Core names the zoom "Max Zoom" for "Fit to data": it limits the fit. */}
      <InlineField label={fields.padding ? 'Max Zoom' : 'Zoom'} labelWidth={labelWidth} grow>
        <GeoFixedNumberInput
          aria-label="Zoom"
          value={view.zoom ?? 1}
          {...ZOOM_RANGE}
          onChange={(zoom) => set({ zoom })}
        />
      </InlineField>
      <InlineField label="Min zoom" labelWidth={labelWidth} grow>
        <GeoFixedNumberInput
          aria-label="Min zoom"
          value={view.minZoom ?? ZOOM_LIMIT_RANGE.min}
          {...ZOOM_LIMIT_RANGE}
          onChange={(minZoom) => set({ minZoom })}
        />
      </InlineField>
      <InlineField label="Max zoom limit" labelWidth={labelWidth} grow>
        <GeoFixedNumberInput
          aria-label="Max zoom limit"
          value={view.maxZoom ?? ZOOM_LIMIT_RANGE.max}
          {...ZOOM_LIMIT_RANGE}
          onChange={(maxZoom) => set({ maxZoom })}
        />
      </InlineField>
      <Button
        variant="secondary"
        size="sm"
        fullWidth
        onClick={() => {
          onChange(applyCurrentMapView(view, context.instanceState));
        }}
      >
        Use current map settings
      </Button>
    </Stack>
  );
};
