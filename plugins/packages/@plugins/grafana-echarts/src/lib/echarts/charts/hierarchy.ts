import { getFieldShapeIssue } from './dataShape';
import { type VizLegendItem } from '@grafana/ui';
import { type FieldConfigSource } from '@grafana/data';
import { frameToHierarchy, getHierarchyValueField, type HierarchyData } from 'lib/echarts/converters/hierarchy';
import {
  getSunburstSeries,
  getTreemapSeries,
  hierarchyDefaultOptions,
  type HierarchySeriesContext,
  makeHierarchyColorResolver,
} from 'lib/echarts/options/hierarchy';
import { DEFAULT_CHART_LEGEND } from 'lib/echarts/options/legend';
import { getHiddenSeriesNames } from 'lib/grafana/fields/seriesConfig';
import {
  type ChartModule,
  type EChartSunburstSeriesOption,
  type EChartTreemapSeriesOption,
  type HierarchyChartContext,
} from './types';

/**
 * Top-level node names that the legend visibility toggle hides. The legend lists
 * the roots, so the toggle writes root names into the `hideSeriesFrom` override.
 * https://grafana.com/docs/grafana/latest/panels-visualizations/configure-legend/#isolate-series-data-in-a-visualization
 */
function getHiddenRootNames(data: HierarchyData, fieldConfig: FieldConfigSource): Set<string> {
  return getHiddenSeriesNames(
    fieldConfig,
    data.roots.map((root) => root.name)
  );
}

/**
 * Hierarchy chart family: treemap and sunburst built from a value-weighted tree.
 *
 * The tree is reconstructed from either a flame-graph nested-set frame or a flat
 * categorical frame (see echarts/converters/hierarchy.ts). Both render variants
 * share the same model; `ctx.seriesType` selects treemap vs sunburst.
 */
export const hierarchyChartModule: ChartModule = {
  legend: DEFAULT_CHART_LEGEND,

  getDataIssue(ctx) {
    return getFieldShapeIssue(ctx.frames, { number: true });
  },

  buildOption(ctx: HierarchyChartContext, _base): EChartTreemapSeriesOption | EChartSunburstSeriesOption | null {
    const data = frameToHierarchy(ctx.frames, ctx.theme);
    if (!data) {
      return null;
    }

    const seriesCtx: HierarchySeriesContext = {
      ...ctx,
      valueField: getHierarchyValueField(ctx.frames),
      // A legend click hides a top-level node, as a core pie hides a slice.
      hiddenRoots: getHiddenRootNames(data, ctx.fieldConfig),
    };

    if (ctx.seriesType === 'sunburst') {
      return { ...hierarchyDefaultOptions, series: [getSunburstSeries(data, seriesCtx)] };
    }
    return { ...hierarchyDefaultOptions, series: [getTreemapSeries(data, seriesCtx)] };
  },

  buildLegendItems(ctx): VizLegendItem[] {
    const data = frameToHierarchy(ctx.frames, ctx.theme);
    if (!data) {
      return [];
    }

    // Only top-level nodes are listed; deeper nodes inherit derived shades and
    // would overwhelm a flat legend. Swatch color mirrors the chart via the shared
    // resolver: a fixed-color override wins, then the field's by-value color
    // scheme, then the classic palette by position.
    const hidden = getHiddenRootNames(data, ctx.fieldConfig);
    const resolveColor = makeHierarchyColorResolver(ctx.theme, ctx.fieldConfig, getHierarchyValueField(ctx.frames));
    return data.roots.map((root, index) => ({
      label: root.name,
      fieldName: root.name,
      color: resolveColor(root.name, root.value, index, 0),
      yAxis: 1,
      disabled: hidden.has(root.name),
      getItemKey: () => `hierarchy-${index}`,
      getDisplayValues: () => [],
    }));
  },
};
