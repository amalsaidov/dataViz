import { StackingMode } from '@grafana/schema';
import { debug, LOG_LEVELS } from 'development';
import { type CartesianSingleValueSeriesType } from 'editor/types';
import { type CartesianOption, type ChartContext } from 'lib/echarts/charts/types';
import { fallbackCategories, framesToCategoryCartesian } from 'lib/echarts/converters/categoryCartesianModel';
import {
  getFieldStackId,
  resolveFieldSeriesType,
  resolveFieldLineDash,
  resolveFieldSpanNulls,
  resolveFieldStack,
  resolveFieldStyleOptions,
} from 'lib/echarts/converters/fieldOverrides';
import { findColorByField, resolveSeriesValues } from 'lib/echarts/converters/cartesianValues';
import { type CartesianLayout, type CategoryCartesianData } from 'lib/echarts/converters/types';
import { resolvePanelStacking } from 'lib/echarts/options/bars';
import { buildCartesianSeries } from 'lib/echarts/options/cartesian';
import { getDensityFromSeriesValues, getSeriesPerfOptions } from 'lib/echarts/performance/resolvers';
import { getValueFormatter } from 'lib/echarts/style';

/**
 * Convert Grafana Numeric frames into an ECharts category-axis cartesian chart.
 *
 * The string field becomes the shared category x-axis and each numeric field
 * becomes one series, its values plotted against those categories. Series span
 * every frame in the response, joined by category label; see
 * `framesToCategoryCartesian` for that contract.
 *
 * Per-field `custom.seriesType`, `custom.stackSeries` and `custom.stackGroup` overrides are honored
 * here exactly as they are on the time axis (both read the shared resolvers in
 * `converters/fieldOverrides.ts`), so a panel can mix render types — e.g. a
 * scatter overlay on a categorical bar chart. An unset field inherits the
 * panel-level series type.
 */
export function categoryCartesianToEChartsOption(
  ctx: ChartContext<CartesianSingleValueSeriesType>,
  layout: CartesianLayout = { horizontal: false }
): CategoryCartesianData {
  const { frames, theme, seriesType, options, timeZone } = ctx;
  const model = framesToCategoryCartesian(frames, theme);

  if (!model) {
    // Hiding every series via the legend strips all numeric value fields, leaving
    // frames with no series. Keep the category axis and render nothing (matches
    // core Grafana) by reusing the labels from the remaining frame.
    if (frames.length > 0) {
      return { categories: fallbackCategories(frames), series: [] };
    }

    // We should bail for empty/invalid frames earlier then this
    debug('Categorical-x cartesian plots must have categorical data', LOG_LEVELS.warn, frames);
    throw new Error('Categorical-x cartesian plots must have categorical data');
  }

  // Density drives the same fast-path props as the time-axis converter, computed
  // once over every series so a dense chart never renders half on the fast path.
  const density = getDensityFromSeriesValues(model.series.map(({ values }) => values));
  const stackAll = resolvePanelStacking(options) !== StackingMode.None;

  // Per-field override wins over the panel type; a non-single-value override
  // (candlestick/boxplot/Auto) falls back to it. Only bar stacks, so the stack
  // group is gated on the *resolved* type rather than the panel's.
  const sources = model.series.map(({ field, values, rows, frame, color }) => {
    const resolvedType = resolveFieldSeriesType<CartesianSingleValueSeriesType>(field, seriesType);
    const isBar = resolvedType === 'bar';
    const stacked = isBar && resolveFieldStack(field, stackAll);
    return {
      field,
      values,
      rows,
      color,
      resolvedType,
      isBar,
      stacked,
      ...(stacked ? { stackId: getFieldStackId(field, true) } : {}),
      formatValue: getValueFormatter(field, theme, timeZone),
      colorField: findColorByField(frame, frames, options),
    };
  });
  const resolved = resolveSeriesValues(
    sources,
    { horizontal: layout.horizontal, bandCount: model.categories.length, plotLength: layout.plotLength },
    options,
    theme
  );

  const echartsSeries: CartesianOption['series'] = model.series.map(({ name, color, values }, i) => {
    const { resolvedType, stacked } = sources[i];
    // The field style (line width, fill opacity, point size and show points) wins over the panel option.
    const seriesOptions = resolveFieldStyleOptions(sources[i].field, options);
    return buildCartesianSeries(
      {
        name,
        color,
        zlevel: options.zLevel?.series,
        formatValue: sources[i].formatValue,
        ...resolved[i],
        // Keyed off the resolved type: line and bar/scatter arm different levers
        // (LTTB sampling vs `large`), so passing the panel type would put an
        // overridden field on the wrong fast path.
        perf: getSeriesPerfOptions({ type: resolvedType, density, options: seriesOptions, values }),
        // Only bars stack here, so each stack id has the bar base and the field's stack group.
        ...(stacked ? { stack: sources[i].stackId } : {}),
        // A category axis has no x distance, so only `true` connects. The chart module reports a
        // numeric threshold here as not supported (see `getSpanNullsNotices`).
        ...(resolvedType === 'line' && resolveFieldSpanNulls(sources[i].field) === true ? { connectNulls: true } : {}),
        ...(resolvedType === 'line' ? resolveFieldLineDash(sources[i].field) : undefined),
      },
      resolvedType,
      seriesOptions,
      theme
    );
  });

  return { categories: model.categories, series: echartsSeries };
}
