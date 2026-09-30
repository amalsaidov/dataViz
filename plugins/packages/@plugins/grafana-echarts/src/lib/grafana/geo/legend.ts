// The legend of the core Geomap markers layer (`MarkersLegend`).
// Core: https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/components/MarkersLegend.tsx
// and `getThresholdItems` in https://github.com/grafana/grafana/blob/main/public/app/core/components/TimelineChart/utils.ts
import {
  type DataFrame,
  type Field,
  formattedValueToString,
  getDisplayProcessor,
  getFieldColorModeForField,
  getMinMaxAndDelta,
  getValueFormat,
  type GrafanaTheme2,
  ThresholdsMode,
} from '@grafana/data';
import { type MapLayerOptions } from '@grafana/schema';
import { DEFAULT_MARKER_STYLE, findField, type MarkerStyleConfig } from './dimensions';
import { getLayerFrames, MARKERS_LAYER_TYPE, resolveLayers } from './layers';

/** One color of a thresholds legend. */
export interface MarkerLegendItem {
  label: string;
  color: string;
}

/** What the legend of a layer shows. */
export type MarkerLegendBody =
  /** A fixed color: the layer symbol in that color. */
  | { kind: 'symbol'; symbol: string; color: string; opacity: number }
  /** A continuous color scheme of a field: a gradient from the field min to the field max. */
  | { kind: 'scale'; colors: string[]; min: string; max: string }
  /** The thresholds of a field: one color for each step. */
  | { kind: 'thresholds'; items: MarkerLegendItem[] };

/** The legend of one markers layer. */
export interface MarkerLegend {
  name: string;
  body: MarkerLegendBody;
}

interface MarkersConfig {
  showLegend?: boolean;
  style?: MarkerStyleConfig;
}

/** Core `getThresholdItems`: `< next` for the base step, `value+` for the other steps. */
function getThresholdItems(field: Field, theme: GrafanaTheme2): MarkerLegendItem[] {
  const { thresholds, unit, decimals } = field.config;
  const steps = thresholds?.steps ?? [];
  const getDisplay = getValueFormat(thresholds?.mode === ThresholdsMode.Percentage ? 'percent' : (unit ?? ''));
  const format = (value: number) => formattedValueToString(getDisplay(value, decimals ?? undefined));
  return steps.map((step, i) => {
    const base = step.value === -Infinity && i < steps.length - 1;
    const value = base ? steps[i + 1].value : step.value;
    return {
      label: `${base ? '< ' : ''}${format(value)}${base ? '' : '+'}`,
      color: theme.visualization.getColorByName(step.color),
    };
  });
}

/** The legend body of one layer, or `undefined` when core shows no legend for it. */
function getLegendBody(
  frame: DataFrame | undefined,
  cfg: MarkerStyleConfig = DEFAULT_MARKER_STYLE,
  theme: GrafanaTheme2
): MarkerLegendBody | undefined {
  const colorField = frame && cfg.color?.field ? findField(frame, cfg.color.field) : undefined;
  if (!colorField) {
    const symbol = cfg.symbol?.fixed;
    const color = theme.visualization.getColorByName(cfg.color?.fixed ?? DEFAULT_MARKER_STYLE.color.fixed);
    return symbol ? { kind: 'symbol', symbol, color, opacity: cfg.opacity ?? DEFAULT_MARKER_STYLE.opacity } : undefined;
  }
  const mode = getFieldColorModeForField(colorField);
  if (mode.isContinuous && mode.getColors) {
    const range = getMinMaxAndDelta(colorField);
    const display = colorField.display ?? getDisplayProcessor({ field: colorField, theme });
    const label = (value: number) => formattedValueToString(display(value));
    return { kind: 'scale', colors: mode.getColors(theme), min: label(range.min ?? 0), max: label(range.max ?? 100) };
  }
  if ((colorField.config.thresholds?.steps.length ?? 0) < 2) {
    return undefined;
  }
  return { kind: 'thresholds', items: getThresholdItems(colorField, theme) };
}

/**
 * The legend of each markers layer with `config.showLegend`, in the layer order. Core shows the legend when the
 * option is unset (`defaultOptions` of the markers layer). The color field is in the first frame of the layer.
 */
export function getMarkerLegends(
  frames: DataFrame[],
  layers: MapLayerOptions[] | undefined,
  theme: GrafanaTheme2,
  queryRefIds?: string[]
): MarkerLegend[] {
  // An unnamed layer gets the name `Layer <n>` of its position, as the layer editor names a new layer.
  return resolveLayers(layers).flatMap((layer: MapLayerOptions<MarkersConfig>, index) => {
    if (layer.type !== MARKERS_LAYER_TYPE || layer.config?.showLegend === false) {
      return [];
    }
    const frame = getLayerFrames(frames, layer, queryRefIds)[0];
    const body = getLegendBody(frame, layer.config?.style, theme);
    return body ? [{ name: layer.name || `Layer ${index + 1}`, body }] : [];
  });
}
