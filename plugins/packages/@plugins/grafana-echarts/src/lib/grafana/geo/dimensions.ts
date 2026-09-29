// The style of the core Geomap markers layer, and the values of each marker from the fields of a frame.
// Core: https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/style/types.ts
// https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/style/utils.ts
// and the dimension suppliers in https://github.com/grafana/grafana/tree/main/public/app/features/dimensions
import {
  type DataFrame,
  type Field,
  FieldType,
  formattedValueToString,
  getDisplayProcessor,
  getFieldColorModeForField,
  getFieldConfigWithMinMax,
  getFieldDisplayName,
  getMinMaxAndDelta,
  type GrafanaTheme2,
} from '@grafana/data';
import {
  type ColorDimensionConfig,
  type ResourceDimensionConfig,
  ResourceDimensionMode,
  type ScalarDimensionConfig,
  ScalarDimensionMode,
  type ScaleDimensionConfig,
  type TextDimensionConfig,
  TextDimensionMode,
} from '@grafana/schema';

/** The core `SymbolAlign`. */
export interface SymbolAlign {
  horizontal?: 'left' | 'center' | 'right';
  vertical?: 'top' | 'center' | 'bottom';
}

/** The core `TextStyleConfig`: the text options of OpenLayers `Text`. */
export interface TextStyleConfig {
  fontSize?: number;
  offsetX?: number;
  offsetY?: number;
  textAlign?: 'left' | 'center' | 'right';
  textBaseline?: 'top' | 'middle' | 'bottom';
}

/** The core `StyleConfig` (`layers[].config.style`) that the markers layer reads. */
export interface MarkerStyleConfig {
  color?: ColorDimensionConfig;
  opacity?: number;
  size?: ScaleDimensionConfig;
  symbol?: ResourceDimensionConfig;
  symbolAlign?: SymbolAlign;
  text?: TextDimensionConfig;
  textConfig?: TextStyleConfig;
  rotation?: ScalarDimensionConfig;
}

/** The core `defaultStyleConfig`. */
export const DEFAULT_MARKER_STYLE = {
  size: { fixed: 5, min: 2, max: 15 },
  color: { fixed: 'dark-green' },
  opacity: 0.4,
  symbol: { mode: ResourceDimensionMode.Fixed, fixed: 'img/icons/marker/circle.svg' },
  symbolAlign: { horizontal: 'center', vertical: 'center' },
  textConfig: { fontSize: 12, textAlign: 'center', textBaseline: 'middle', offsetX: 0, offsetY: 0 },
  rotation: { fixed: 0, mode: ScalarDimensionMode.Mod, min: -360, max: 360 },
} satisfies MarkerStyleConfig;

/** The style of all markers of a layer. */
export interface MarkerLayerStyle {
  /** The core symbol path (`symbol.fixed`), for example `img/icons/marker/star.svg`. */
  symbol?: string;
  /** False when core draws the text only: a text and no symbol. */
  showSymbol: boolean;
  symbolAlign: SymbolAlign;
  /** The text options, when the style has a text. */
  text?: Required<TextStyleConfig> & { fontFamily: string };
}

/** The values of one marker. */
export interface MarkerValues {
  /** The CSS color of the text, and the base color of the symbol. */
  color: string;
  /** The CSS color of the symbol. */
  fill: string;
  /** The CSS color of the faint disc behind an icon symbol. */
  iconBackground: string;
  /** The core size: the circle radius in px. An icon or a shape is `2 * size` px wide. */
  size: number;
  /** The rotation in degrees, clockwise. */
  rotation: number;
  text?: string;
}

/** Core `styleUsesText`: a fixed mode with a text, or a field mode with a field. */
function styleUsesText(text?: TextDimensionConfig): boolean {
  return Boolean(
    (text?.mode === TextDimensionMode.Fixed && text.fixed?.length) ||
    (text?.mode === TextDimensionMode.Field && text.field?.length)
  );
}

/** The style of the layer, from the core style config. An unset config gives the core default style. */
export function getMarkerLayerStyle(
  cfg: MarkerStyleConfig = DEFAULT_MARKER_STYLE,
  theme: GrafanaTheme2
): MarkerLayerStyle {
  const symbol = cfg.symbol?.fixed || undefined;
  const hasText = styleUsesText(cfg.text);
  return {
    symbol,
    // Core draws only the text layer for a text with no symbol.
    showSymbol: !hasText || Boolean(symbol),
    symbolAlign: cfg.symbolAlign ?? DEFAULT_MARKER_STYLE.symbolAlign,
    text: hasText
      ? {
          ...DEFAULT_MARKER_STYLE.textConfig,
          ...(cfg.textConfig ?? {}),
          fontFamily: theme.typography.fontFamily,
        }
      : undefined,
  };
}

/** Core `findField`: the field of the name or the display name. */
function findField(frame: DataFrame, name?: string): Field | undefined {
  return name ? frame.fields.find((f) => f.name === name || getFieldDisplayName(f, frame) === name) : undefined;
}

type Supplier<T> = (row: number) => T;

/** Core `getColorDimension`. The color of a field that has no by-value mode or mappings is the same for each row. */
function getColorSupplier(frame: DataFrame, cfg: ColorDimensionConfig, theme: GrafanaTheme2): Supplier<string> {
  let field = findField(frame, cfg.field);
  if (!field) {
    const color = theme.visualization.getColorByName(cfg.fixed ?? 'grey');
    return () => color;
  }
  const mode = getFieldColorModeForField(field);
  if (mode.isByValue || field.config.mappings?.length) {
    // Core uses the min and max of the field for the range.
    const config = getFieldConfigWithMinMax(field, true);
    if (config !== field.config) {
      field = { ...field, config, state: undefined };
    }
    const display = getDisplayProcessor({ field, theme });
    const values = field.values;
    return (row) => display(values[row]).color ?? '#ccc';
  }
  const color = mode.getCalculator(field, theme)(0, 0);
  return () => color;
}

/** Core `getScaledDimension`: linear from `min` to `max` over the field range. Core does not read `mode`. */
function getSizeSupplier(frame: DataFrame, cfg: ScaleDimensionConfig): Supplier<number> {
  const field = findField(frame, cfg.field);
  if (!field) {
    const size = cfg.fixed ?? 0;
    return () => size;
  }
  const info = getMinMaxAndDelta(field);
  const delta = cfg.max - cfg.min;
  if (field.values.length < 1 || delta <= 0 || info.delta <= 0) {
    return () => cfg.min;
  }
  return (row) => {
    // Core reads a null as 0, as JavaScript does in a subtraction.
    const value = Number(field.values[row] ?? 0);
    const percent = value === -Infinity ? 0 : (value - info.min!) / info.delta;
    return cfg.min + Math.min(1, Math.max(0, percent)) * delta;
  };
}

/** Core `getScalarDimension`: the field value modulo `max`, or clamped to `min` and `max`. */
function getRotationSupplier(frame: DataFrame, cfg: ScalarDimensionConfig): Supplier<number> {
  const field = findField(frame, cfg.field);
  if (!field) {
    const rotation = cfg.fixed ?? 0;
    return () => rotation;
  }
  return (row) => {
    const value: unknown = field.values[row];
    if (typeof value !== 'number') {
      return 0;
    }
    return cfg.mode === ScalarDimensionMode.Clamped ? Math.min(cfg.max, Math.max(cfg.min, value)) : value % cfg.max;
  };
}

/** Core `getTextDimension` in the field mode: the display text of the value. */
function getTextSupplier(
  frame: DataFrame,
  cfg: TextDimensionConfig,
  theme: GrafanaTheme2
): Supplier<string | undefined> {
  const field = cfg.field ? findField(frame, cfg.field) : frame.fields.find((f) => f.type === FieldType.string);
  if (cfg.mode !== TextDimensionMode.Field || !field) {
    return () => cfg.fixed;
  }
  const display = field.display ?? getDisplayProcessor({ field, theme });
  return (row) => formattedValueToString(display(field.values[row]));
}

/**
 * The red, green, blue and alpha of a symbol color, as core `getRGBValues`. Core reads a hex color with no alpha
 * and an `rgb()` or `rgba()` color. It draws any other color, for example a CSS color name, in white.
 */
function getSymbolRgba(color: string): [number, number, number, number] {
  if (color.startsWith('#')) {
    const hex = (i: number) => parseInt(color.slice(i, i + 2), 16);
    return [hex(1), hex(3), hex(5), 1];
  }
  const numbers = color.startsWith('rgb') ? (color.match(/\d+\.?\d*/g) ?? []) : [];
  if (numbers.length === 3 || numbers.length === 4) {
    const [r, g, b] = numbers.map((n) => parseInt(n, 10));
    return [r, g, b, numbers.length === 4 ? parseFloat(numbers[3]) : 1];
  }
  return [255, 255, 255, 1];
}

/**
 * The values of each row of a frame. A dimension that has no field gives its fixed value.
 * Core draws the symbols with OpenLayers `WebGLPointsLayer`: the color alpha and the layer opacity each take
 * `opacity`, so a symbol has the alpha `opacity * opacity`. The stroke has the fill color.
 * https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/layers/data/markersLayer.tsx
 * https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/style/markers.ts (`getWebGLStyle`)
 */
export function getMarkerValues(
  frame: DataFrame,
  cfg: MarkerStyleConfig = DEFAULT_MARKER_STYLE,
  theme: GrafanaTheme2
): Supplier<MarkerValues> {
  const color = cfg.color?.field?.length ? getColorSupplier(frame, cfg.color, theme) : undefined;
  const size = cfg.size?.field?.length ? getSizeSupplier(frame, cfg.size) : undefined;
  const rotation = cfg.rotation?.field?.length ? getRotationSupplier(frame, cfg.rotation) : undefined;
  const hasText = styleUsesText(cfg.text);
  const text = hasText && cfg.text?.field?.length ? getTextSupplier(frame, cfg.text, theme) : undefined;
  const baseColor = theme.visualization.getColorByName(cfg.color?.fixed ?? DEFAULT_MARKER_STYLE.color.fixed);
  const opacity = cfg.opacity ?? DEFAULT_MARKER_STYLE.opacity;
  const baseSize = cfg.size?.fixed ?? DEFAULT_MARKER_STYLE.size.fixed;
  const baseRotation = cfg.rotation?.fixed ?? DEFAULT_MARKER_STYLE.rotation.fixed;

  return (row) => {
    const css = theme.visualization.getColorByName(color ? color(row) : baseColor);
    const [r, g, b, a] = getSymbolRgba(css);
    const rgba = (alpha: number) => `rgba(${r}, ${g}, ${b}, ${Math.round(alpha * 1e4) / 1e4})`;
    return {
      color: css,
      fill: rgba(opacity * opacity * a),
      // Core adds a disc of alpha `0.1 / opacity` to an icon, then applies the icon color and opacity.
      iconBackground: rgba(0.1 * opacity * a),
      size: size ? size(row) : baseSize,
      rotation: rotation ? rotation(row) : baseRotation,
      text: hasText ? (text ? text(row) : cfg.text?.fixed) : undefined,
    };
  };
}
