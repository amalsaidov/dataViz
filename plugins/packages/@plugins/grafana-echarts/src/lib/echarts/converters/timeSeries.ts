import { type Field, getFieldDisplayName } from '@grafana/data';
import { StackingMode } from '@grafana/schema';
import { STACK_GROUP_ID } from 'editor/cartesian';
import { type CartesianSingleValueSeriesType, type HeatmapSeriesType, type SeriesType } from 'editor/types';
import { type CartesianContextWithOverlay, type EChartSingleValueCartesianSeries } from 'lib/echarts/charts/types';
import {
  resolveFieldSeriesType,
  resolveFieldSpanNulls,
  resolveFieldStack,
} from 'lib/echarts/converters/fieldOverrides';
import { findColorByField, resolveSeriesValues } from 'lib/echarts/converters/cartesianValues';
import { forEachTimeSeriesField, type TimeSeriesFieldRef } from 'lib/echarts/converters/frames';
import { isSpanNullsThreshold, spannedRows } from 'lib/echarts/converters/spanNulls';
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
  const sources = refs.map(({ frame, field, timeField, type }) => {
    const isBar = type === 'bar';
    // The frame rows that the series draws: all rows, or the rows that a numeric "Connect null
    // values" keeps (see `getDrawnRows`). The field keeps its values.
    const rows = getDrawnRows(field, timeField.values, type);
    return {
      field,
      values: rows.map((row) => field.values[row] ?? null),
      rows,
      color: getCartesianSeriesColor(field, frames, theme),
      xs: rows.map((row) => timeField.values[row]),
      isBar,
      // Only bar supports stacking.
      stacked: isBar && resolveFieldStack(field, stackAll),
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
    { horizontal: false, bandCount, plotLength: layout.plotLength },
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
    const perf = getSeriesPerfOptions({
      type,
      density,
      options,
      // A connected line draws a segment between each two values, so the symbol check skips the nulls.
      values: connectNulls ? sources[i].values.filter((value) => value != null) : sources[i].values,
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
        ...(sources[i].stacked ? { stack: STACK_GROUP_ID } : {}),
        ...(connectNulls ? { connectNulls } : {}),
      },
      type,
      options,
      theme
    );
  });
}

/**
 * The frame rows that the series of a field draws, in order. Each row, except for a `line` series
 * with a numeric "Connect null values": then the nulls that the line connects over are left out
 * (see `spannedRows`). The tooltip maps an ECharts `dataIndex` back to its frame row with this list.
 */
export function getDrawnRows(field: Field, xs: ArrayLike<unknown>, type: SeriesType): number[] {
  const spanNulls = resolveFieldSpanNulls(field);
  if (type === 'line' && isSpanNullsThreshold(spanNulls)) {
    return spannedRows(xs, field.values, spanNulls);
  }
  return Array.from(field.values, (_, row) => row);
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
