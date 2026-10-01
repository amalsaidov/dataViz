import { type Field } from '@grafana/data';
import { LineInterpolation } from '@grafana/schema';
import { LINE_STACK_GROUP_ID, STACK_GROUP_ID } from 'editor/cartesian';
import { type CartesianSingleValueSeriesType, type PerformanceMode } from 'editor/types';
import { isCartesianSingleValueSeriesType } from 'lib/echarts/charts/narrowing';
import { type SpanNulls } from 'lib/echarts/converters/spanNulls';
import { getFieldConfigFromField } from 'lib/grafana/fields/fieldConfig';
import { type PanelOptions } from 'types';

/**
 * Per-field cartesian render overrides, shared by both cartesian converters
 * (time axis and category axis) so a panel mixes render types the same way
 * whichever axis its data selects. The editor registers these for the whole
 * cartesian family (see `modules/cartesian/module.tsx`), so reading them on only
 * one axis path leaves the control visible but inert.
 */

/**
 * Resolve the series type for a single value field: field override wins when cartesian.
 *
 * The `isCartesianSingleValueSeriesType` gate drops overrides the per-field
 * picker offers but no single series can render — `candlestick` / `boxplot` build
 * one series from several fields, and `Auto` means "inherit" — so those fall back
 * to `defaultType` (the panel-level series type).
 */
export function resolveFieldSeriesType<T>(field: Field, defaultType: T): T | CartesianSingleValueSeriesType {
  const seriesTypeOverride = getFieldConfigFromField(field).custom?.seriesType;
  if (seriesTypeOverride && isCartesianSingleValueSeriesType(seriesTypeOverride)) {
    return seriesTypeOverride;
  }
  return defaultType;
}

/**
 * Whether a field should stack: field override wins over the panel default.
 * Bar series stack, and line series on a time axis (`isTimeSeriesStacked`), so
 * callers gate on the resolved render type.
 */
export function resolveFieldStack(field: Field, panelStack = false): boolean {
  const override = getFieldConfigFromField(field).custom?.stackSeries;
  return override ?? panelStack;
}

/** The default stack group of core Time series (`custom.stacking.group`). */
export const DEFAULT_STACK_GROUP = 'A';

/**
 * The ECharts `stack` id of a stacked field: its draw style (bar or line) and its stack group, as the
 * stack key of core `getStackingGroups`. The default group keeps the id without a group.
 * https://echarts.apache.org/en/option.html#series-bar.stack
 */
export function getFieldStackId(field: Field, isBar: boolean): string {
  const base = isBar ? STACK_GROUP_ID : LINE_STACK_GROUP_ID;
  const group = getFieldConfigFromField(field).custom?.stackGroup;
  return typeof group !== 'string' || group === '' || group === DEFAULT_STACK_GROUP ? base : `${base}:${group}`;
}

/**
 * The "Connect null values" setting of a field (core `custom.spanNulls`, default `false`). A value
 * that is not a boolean or a finite number reads as `false`. See `spanNulls.ts`.
 */
export function resolveFieldSpanNulls(field: Field): SpanNulls {
  const spanNulls = getFieldConfigFromField(field).custom?.spanNulls;
  if (typeof spanNulls === 'boolean' || (typeof spanNulls === 'number' && Number.isFinite(spanNulls))) {
    return spanNulls;
  }
  return false;
}

/**
 * The "Line interpolation" of a field (core `custom.lineInterpolation`, default `linear`). An unknown value reads as
 * `linear`. Core: https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/time-series/#line-interpolation
 */
export function resolveFieldLineInterpolation(field: Field): LineInterpolation {
  const value = getFieldConfigFromField(field).custom?.lineInterpolation;
  return value !== undefined && Object.values(LineInterpolation).includes(value) ? value : LineInterpolation.Linear;
}

/**
 * The ECharts dash of a field (core `custom.lineStyle`): `undefined` for a solid line. A dash or a dot
 * without segments uses `[10, 10]`, and a dot has round ends, as core `UPlotSeriesBuilder`:
 * https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/uPlot/config/UPlotSeriesBuilder.ts
 */
export function resolveFieldLineDash(field: Field): { lineDash: number[]; lineRoundCap?: boolean } | undefined {
  const custom: Record<string, unknown> = { ...getFieldConfigFromField(field).custom };
  const lineStyle: Record<string, unknown> =
    typeof custom.lineStyle === 'object' && custom.lineStyle !== null ? { ...custom.lineStyle } : {};
  const { fill, dash } = lineStyle;
  if (fill !== 'dash' && fill !== 'dot') {
    return undefined;
  }
  const segments: unknown[] = Array.isArray(dash) ? dash : [];
  const numbers = segments.filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
  const lineDash = numbers.length > 0 && numbers.length === segments.length ? numbers : [10, 10];
  return { lineDash, ...(fill === 'dot' ? { lineRoundCap: true } : {}) };
}

/**
 * The panel options of one series, with the series style of its field: `custom.lineWidth`,
 * `custom.fillOpacity`, `custom.pointSize` and `custom.showPoints`. A field value wins over the panel
 * option, as in core Time series. A field with no value keeps the panel option.
 * Core: https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/time-series/#graph-styles
 */
export function resolveFieldStyleOptions(field: Field, options: PanelOptions): PanelOptions {
  const custom: Record<string, unknown> = { ...getFieldConfigFromField(field).custom };
  const number = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);
  const lineWidth = number(custom.lineWidth);
  const fillOpacity = number(custom.fillOpacity);
  const pointSize = number(custom.pointSize);
  const showPoints = SHOW_POINTS.find((mode) => mode === custom.showPoints);
  if (lineWidth === undefined && fillOpacity === undefined && pointSize === undefined && showPoints === undefined) {
    return options;
  }
  return {
    ...options,
    ...(lineWidth !== undefined ? { lineWidth } : {}),
    ...(fillOpacity !== undefined ? { fillOpacity } : {}),
    ...(pointSize !== undefined ? { pointSize } : {}),
    ...(showPoints !== undefined ? { performance: { ...options.performance, showPoints } } : {}),
  };
}

/** The core `showPoints` values (`VisibilityMode`). They are the same as the panel `performance.showPoints`. */
const SHOW_POINTS: PerformanceMode[] = ['auto', 'always', 'never'];
