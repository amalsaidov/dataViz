// The points of the core Geomap heatmap layer.
// Core: https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/layers/data/heatMap.tsx
import {
  type DataFrame,
  FieldType,
  getFieldColorModeForField,
  getMinMaxAndDelta,
  type GrafanaTheme2,
} from '@grafana/data';
import { type MapLayerOptions, type ScaleDimensionConfig } from '@grafana/schema';
import { findField } from './dimensions';
import { type LonLat } from './gazetteer';
import { getLayerFrames, HEATMAP_LAYER_TYPE, resolveLayers } from './layers';
import { getFramePositions, getLocationMatchers } from './location';
import { wrapLongitude } from './markers';

/** The core heatmap layer config (`HeatmapConfig`). */
export interface HeatmapConfig {
  weight?: ScaleDimensionConfig;
  radius?: number;
  blur?: number;
}

/** The core `defaultOptions` of the heatmap layer. */
export const DEFAULT_HEATMAP_CONFIG = {
  weight: { fixed: 1, min: 0, max: 1 },
  blur: 15,
  radius: 5,
} satisfies Required<HeatmapConfig>;

/** The core gradient when the weight field has no continuous color scheme. */
export const DEFAULT_HEATMAP_COLORS = ['#00f', '#0ff', '#0f0', '#ff0', '#f00'];

/** One point: the position and the weight of its row, from 0 to 1. */
export interface HeatmapPoint {
  lonLat: LonLat;
  weight: number;
}

/** The points of a heatmap layer and the options that all of them share. */
export interface GeoHeatmap {
  points: HeatmapPoint[];
  /** The radius and the blur in px, as OpenLayers `Heatmap`. */
  radius: number;
  blur: number;
  /** The gradient from a weight of 0 to a weight of 1. */
  colors: string[];
  /** The index of the layer in the core layer list. A later layer draws on top. */
  layerIndex: number;
}

/**
 * Core `getScaledDimension`: linear from `min` to `max` over the field range. With no field, the fixed value.
 * OpenLayers clamps the weight to 0 to 1.
 */
function getWeights(frame: DataFrame, cfg: ScaleDimensionConfig): (row: number) => number {
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const field = findField(frame, cfg.field);
  if (!field) {
    const fixed = clamp(cfg.fixed ?? 0);
    return () => fixed;
  }
  const info = getMinMaxAndDelta(field);
  const delta = cfg.max - cfg.min;
  if (field.values.length < 1 || delta <= 0 || info.delta <= 0) {
    return () => clamp(cfg.min);
  }
  return (row) => {
    // Core reads a null as 0, as JavaScript does in a subtraction.
    const value = Number(field.values[row] ?? 0);
    const percent = value === -Infinity ? 0 : (value - info.min!) / info.delta;
    return clamp(cfg.min + Math.min(1, Math.max(0, percent)) * delta);
  };
}

/**
 * The gradient, as core: the colors of the continuous color scheme of the weight field, or of the first number field.
 * Else the core default gradient.
 * https://grafana.com/docs/grafana/latest/panels-visualizations/configure-standard-options/#color-scheme
 */
function getColors(frame: DataFrame, cfg: ScaleDimensionConfig, theme: GrafanaTheme2): string[] {
  const field = findField(frame, cfg.field) ?? frame.fields.find((f) => f.type === FieldType.number);
  if (field) {
    const mode = getFieldColorModeForField(field);
    if (mode.isContinuous && mode.getColors) {
      return mode.getColors(theme);
    }
  }
  return DEFAULT_HEATMAP_COLORS;
}

/** The points of one heatmap layer. Only the first frame of the layer gives points, as core `data.series[0]`. */
function getHeatmap(
  frames: DataFrame[],
  layer: Partial<MapLayerOptions<HeatmapConfig>>,
  layerIndex: number,
  theme: GrafanaTheme2,
  queryRefIds?: string[]
): GeoHeatmap {
  const config = { ...DEFAULT_HEATMAP_CONFIG, ...layer.config };
  const base = { radius: config.radius, blur: config.blur, layerIndex };
  const frame = getLayerFrames(frames, layer, queryRefIds)[0];
  if (!frame) {
    return { ...base, points: [], colors: DEFAULT_HEATMAP_COLORS };
  }
  const { positions = [] } = getFramePositions(frame, getLocationMatchers(layer.location));
  const weight = getWeights(frame, config.weight);
  const points: HeatmapPoint[] = [];
  positions.forEach((position, row) => {
    if (position) {
      // As the markers: core repeats the world, this panel draws it one time.
      points.push({ lonLat: [wrapLongitude(position[0]), position[1]], weight: weight(row) });
    }
  });
  return { ...base, points, colors: getColors(frame, config.weight, theme) };
}

/** The points of each `heatmap` layer, in the layer order. */
export function getHeatmapLayers(
  frames: DataFrame[],
  layers: MapLayerOptions[] | undefined,
  theme: GrafanaTheme2,
  queryRefIds?: string[]
): GeoHeatmap[] {
  return resolveLayers(layers).flatMap((layer, index) =>
    layer.type === HEATMAP_LAYER_TYPE ? [getHeatmap(frames, layer, index, theme, queryRefIds)] : []
  );
}
