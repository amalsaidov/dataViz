import { type Field, getFieldDisplayName } from '@grafana/data';
import { StackingMode } from '@grafana/schema';
import { type CartesianSingleValueSeriesType, type HeatmapSeriesType, type SeriesType } from 'editor/types';
import { type CartesianContextWithOverlay, type EChartSingleValueCartesianSeries } from 'lib/echarts/charts/types';
import {
  getFieldStackId,
  resolveFieldSeriesType,
  resolveFieldSpanNulls,
  resolveFieldStack,
  resolveFieldStyleOptions,
} from 'lib/echarts/converters/fieldOverrides';
import { findColorByField, resolveSeriesValues } from 'lib/echarts/converters/cartesianValues';
import { forEachTimeSeriesField, type TimeSeriesFieldRef } from 'lib/echarts/converters/frames';
import { isSpanNullsThreshold, spannedRows } from 'lib/echarts/converters/spanNulls';
import { type DrawnSeries, stackedLineSeries } from 'lib/echarts/converters/stackedLines';
import { type CartesianLayout } from 'lib/echarts/converters/types';
import { resolvePanelStacking } from 'lib/echarts/options/bars';
import { buildCartesianSeries } from 'lib/echarts/options/cartesian';
import { getSeriesDensity, getSeriesPerfOptions } from 'lib/echarts/performance/resolvers';
import { getCartesianSeriesColor, getValueFormatter } from 'lib/echarts/style';

/**
 * Convert Grafana time series DataFrames into ECharts series data.
 *
 * Data is emitted as inline `[time, value]` tuples.
 *
 * Series carry the type-aware performance props from `getSeriesPerfOptions`
 * (symbols off / LTTB for dense lines; `large` for dense scatter/bar), computed
 * once from the whole frame set so a dense chart switches every series onto the
 * fast path consistently.
 */
export function timeSeriesToEChartsOption(
  ctx: CartesianContextWithOverlay,
  layout: CartesianLayout = { horizontal: false }
): EChartSingleValueCartesianSeries[] | null {
  const { frames, theme, options, seriesType, timeZone, timeRange } = ctx;

  // Density (total points + densest series) drives the fast-path props; computed
  // once over the whole frame set so every series resolves against the same
  // numbers and a chart never renders half on the fast path.
  const density = getSeriesDensity(frames);
  const stackAll = resolvePanelStacking(options) !== StackingMode.None;

  const refs: Array<TimeSeriesFieldRef<unknown> & { type: CartesianSingleValueSeriesType | HeatmapSeriesType }> = [];
  forEachTimeSeriesField(frames, (ref) => refs.push({ ...ref, type: resolveFieldSeriesType(ref.field, seriesType) }));
  if (refs.length === 0) {
    return null;
  }

  // Cartesian fields share the value, label and bar rules of the category
  // converter; a heatmap-overlay field has no source.
  const drawn = getDrawnSeries(refs, stackAll);
  const sources = refs.map(({ frame, field, timeField, type }, i) => {
    const isBar = type === 'bar';
    // The frame rows that the series draws, and the drawn values (see `getDrawnSeries`). The field
    // keeps its values.
    const { rows, values, drawnValues, connected } = drawn[i];
    const stacked = isTimeSeriesStacked(field, type, stackAll);
    return {
      field,
      values,
      drawnValues,
      connected,
      rows,
      color: getCartesianSeriesColor(field, frames, theme),
      xs: rows.map((row) => timeField.values[row]),
      isBar,
      stacked,
      ...(stacked ? { stackId: getFieldStackId(field, isBar) } : {}),
      formatValue: getValueFormatter(field, theme, timeZone),
      colorField: findColorByField(frame, frames, options),
    };
  });
  const cartesian = sources.filter((_, i) => refs[i].type !== 'heatmap');
  const bandCount = getTimeBandCount(
    cartesian.filter((source) => source.isBar).map((source) => source.xs),
    timeRange.to.valueOf() - timeRange.from.valueOf()
  );
  const resolved = resolveSeriesValues(
    cartesian,
    { horizontal: false, bandCount, plotLength: layout.plotLength, overlapBars: true },
    options,
    theme
  );

  let cartesianIndex = 0;
  return refs.map(({ frame, field, timeField, type }, i) => {
    const { color } = sources[i];
    const name = getFieldDisplayName(field, frame, frames);
    const zlevel = options.zLevel?.series;

    // A heatmap-overlay field is not a cartesian series type (`series.type` is
    // omitted), so it keeps the minimal color-only style rather than the Advanced
    // cartesian options — and gets no fast-path props, which are all cartesian.
    // It still captures hover events so the tooltip can read it.
    if (type === 'heatmap') {
      return {
        name,
        type: undefined,
        data: timeField.values.map((time, row) => [time, field.values[row] ?? null]),
        itemStyle: { color },
        lineStyle: { color },
        zlevel,
        triggerEvent: true,
      };
    }

    // Type-aware fast-path props (symbols/sampling for line; large for
    // scatter/bar). `values` lets the symbol decision spare a series that draws
    // no line, which would otherwise render as nothing at all. `hover` arms the
    // tooltip seam — `triggerEvent` plus, on symbol types, the scaled emphasis
    // marker the `highlight` dispatch drives.
    const connectNulls = type === 'line' && resolveFieldSpanNulls(field) === true;
    const drawnValues = sources[i].drawnValues ?? sources[i].values;
    // The field style (line width, fill opacity, point size and show points) wins over the panel option.
    const seriesOptions = resolveFieldStyleOptions(field, options);
    const perf = getSeriesPerfOptions({
      type,
      density,
      options: seriesOptions,
      // A connected line draws a segment between each two values, so the symbol check skips the nulls.
      values: connectNulls ? drawnValues.filter((value) => value != null) : drawnValues,
    });
    return buildCartesianSeries(
      {
        name,
        color,
        zlevel,
        formatValue: sources[i].formatValue,
        ...resolved[cartesianIndex++],
        perf,
        hover: true,
        ...(sources[i].stackId ? { stack: sources[i].stackId } : {}),
        ...(connectNulls ? { connectNulls } : {}),
      },
      type,
      seriesOptions,
      theme
    );
  });
}

/**
 * Whether a time-axis field stacks: a bar or a line series (a line with a fill is an area), as core
 * Time series. The field override wins over the panel Stacking option (`resolveFieldStack`).
 */
export function isTimeSeriesStacked(field: Field, type: SeriesType, stackAll: boolean): boolean {
  return (type === 'bar' || type === 'line') && resolveFieldStack(field, stackAll);
}

/**
 * The frame rows that the series of each field draws, in order, and the value that it draws at each
 * row. The tooltip maps an ECharts `dataIndex` back to its frame row with `rows`.
 *
 * - The stacked line series of one time field and one stack group: the null rules of a stack (see
 *   `stackedLineSeries`).
 * - A `line` series with a numeric "Connect null values": the nulls that the line connects over are
 *   left out (see `spannedRows`).
 * - Other series: each row, with the field values.
 */
export function getDrawnSeries(
  refs: Array<{ field: Field; timeField: Field; type: SeriesType }>,
  stackAll: boolean
): DrawnSeries[] {
  // The stacks of lines, by time field and by stack id.
  const stacks = new Map<Field, Map<string, Field[]>>();
  for (const { field, timeField, type } of refs) {
    if (type === 'line' && isTimeSeriesStacked(field, type, stackAll)) {
      const byId = stacks.get(timeField) ?? new Map<string, Field[]>();
      const id = getFieldStackId(field, false);
      byId.set(id, [...(byId.get(id) ?? []), field]);
      stacks.set(timeField, byId);
    }
  }
  const stacked = new Map<Field, DrawnSeries>();
  stacks.forEach((byId, timeField) =>
    byId.forEach((fields) => {
      const series = stackedLineSeries(timeField.values, fields);
      fields.forEach((field, i) => stacked.set(field, series[i]));
    })
  );

  return refs.map(({ field, timeField, type }) => {
    const inStack = stacked.get(field);
    if (inStack) {
      return inStack;
    }
    const spanNulls = resolveFieldSpanNulls(field);
    const rows =
      type === 'line' && isSpanNullsThreshold(spanNulls)
        ? spannedRows(timeField.values, field.values, spanNulls)
        : Array.from(field.values, (_, row) => row);
    const values: ArrayLike<number | null | undefined> = field.values;
    return { rows, values: rows.map((row) => values[row] ?? null) };
  });
}

/**
 * Bar bands on a time axis: ECharts sizes a time-axis bar from the smallest gap
 * between two points, so the axis span holds `span / gap` bands.
 * https://echarts.apache.org/en/option.html#series-bar.barWidth
 */
export function getTimeBandCount(times: Array<ArrayLike<unknown>>, span: number): number {
  let gap = Infinity;
  for (const values of times) {
    for (let i = 1; i < values.length; i++) {
      const step = Number(values[i]) - Number(values[i - 1]);
      if (step > 0 && step < gap) {
        gap = step;
      }
    }
  }
  return Number.isFinite(gap) && span > 0 ? span / gap : 0;
}
