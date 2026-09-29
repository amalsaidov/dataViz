import { type StandardEditorProps } from '@grafana/data';
import { type MapLayerOptions } from '@grafana/schema';
import { Button, Stack } from '@grafana/ui';
import React from 'react';
import {
  addMarkersLayer,
  deleteLayer,
  isLayerNameFree,
  moveLayer,
  replaceLayer,
  resolveLayers,
} from 'lib/grafana/geo/layers';
import { GeoLayerRow } from './GeoLayerRow';

/**
 * The data layer list of the geo panel (`layers`), as the core Geomap layers editor: add, delete, move and rename.
 * The top row is the layer that draws on top, as core. The options of each layer are in its own group below.
 * Core: https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/editor/LayersEditor.tsx
 * https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/geomap/#map-layers
 */
export const GeoLayersEditor = ({ value, onChange }: StandardEditorProps<MapLayerOptions[] | undefined>) => {
  const layers = resolveLayers(value);
  // The display order is the reverse of the draw order.
  const rows = layers.map((layer, index) => ({ layer, index })).reverse();
  return (
    <Stack direction="column" gap={1}>
      <Button icon="plus" variant="secondary" size="sm" onClick={() => onChange(addMarkersLayer(layers))}>
        Add layer
      </Button>
      {rows.map(({ layer, index }) => (
        <GeoLayerRow
          key={`${index}-${layer.name}`}
          name={layer.name}
          type={layer.type}
          canMoveUp={index < layers.length - 1}
          canMoveDown={index > 0}
          isNameFree={(name) => isLayerNameFree(layers, index, name)}
          onRename={(name) => onChange(replaceLayer(layers, index, { ...layer, name }))}
          onMoveUp={() => onChange(moveLayer(layers, index, index + 1))}
          onMoveDown={() => onChange(moveLayer(layers, index, index - 1))}
          onDelete={() => onChange(deleteLayer(layers, index))}
        />
      ))}
    </Stack>
  );
};
