import { type Field } from '@grafana/data';
import { AxisPlacement, GraphGradientMode, type GraphFieldConfig, StackingMode } from '@grafana/schema';
import { CARTESIAN_BAR_BORDER_WIDTH_DEFAULT, CARTESIAN_BAR_FILL_OPACITY_DEFAULT } from 'editor/cartesian';
import { type PanelOptions } from 'types';

// The field settings of the core Histogram panel: `custom.stacking`, `custom.fillOpacity`, `custom.lineWidth` and
// `custom.gradientMode`. Core reads them from each count field, so an override changes one field.
// Core source: https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/histogram/Histogram.tsx
// Field config types: https://grafana.com/developers/plugin-tools/reference/panel-options

/** The group name of a field with no `custom.stacking.group`, as core `defaultHistogramConfig`. */
const DEFAULT_STACKING_GROUP = 'A';

/** The style of the bars of one count field. */
export interface HistogramFieldStyle {
  stacking: StackingMode;
  /** The name of the stacking group. */
  group: string;
  /** 0 to 100. */
  fillOpacity: number;
  /** px. */
  lineWidth: number;
  gradientMode: GraphGradientMode;
}

/** The fields of one stacking group, as indexes into the count fields. */
export interface HistogramStackingGroup {
  mode: StackingMode.Normal | StackingMode.Percent;
  fields: number[];
}

/**
 * The style of each count field. A field setting wins. With no field setting, the panel options `stacking`,
 * `barFillOpacity` and `lineWidth` apply, and then the core defaults.
 */
export function getHistogramFieldStyles(counts: Field[], options: PanelOptions): HistogramFieldStyle[] {
  return counts.map((field) => {
    const custom = customOf(field);
    return {
      stacking: custom.stacking?.mode ?? options.stacking ?? StackingMode.None,
      group: custom.stacking?.group || DEFAULT_STACKING_GROUP,
      fillOpacity: finite(custom.fillOpacity) ?? finite(options.barFillOpacity) ?? CARTESIAN_BAR_FILL_OPACITY_DEFAULT,
      lineWidth: finite(custom.lineWidth) ?? finite(options.lineWidth) ?? CARTESIAN_BAR_BORDER_WIDTH_DEFAULT,
      gradientMode: custom.gradientMode ?? GraphGradientMode.None,
    };
  });
}

/**
 * The stacking groups of the count fields, as core `getStackingGroups`. Fields stack together when they have the
 * same stacking mode, the same group name and the same scale key. A field that is hidden, or that does not
 * stack, is in no group. Counts are never negative, so all groups stack up.
 * https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/uPlot/utils.ts
 */
export function getHistogramStackingGroups(
  counts: Field[],
  styles: HistogramFieldStyle[],
  hidden: (index: number) => boolean
): HistogramStackingGroup[] {
  const groups = new Map<string, HistogramStackingGroup>();
  counts.forEach((field, i) => {
    const { stacking: mode, group } = styles[i];
    if (hidden(i) || (mode !== StackingMode.Normal && mode !== StackingMode.Percent)) {
      return;
    }
    const key = `${mode}|${group}|${buildScaleKey(field)}`;
    const found = groups.get(key) ?? { mode, fields: [] };
    found.fields.push(i);
    groups.set(key, found);
  });
  return [...groups.values()];
}

/**
 * The scale part of the stacking key, as core `buildScaleKey`: unit, min and max, soft min and max, axis
 * placement, scale distribution, axis label and field type.
 * https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/uPlot/internal.ts
 */
function buildScaleKey(field: Field): string {
  const { config, type } = field;
  const custom = customOf(field);
  const na = 'na';
  const distribution = custom.scaleDistribution;
  return [
    config.unit ?? '__fixed',
    `${config.min ?? na}-${config.max ?? na}`,
    `${custom.axisSoftMin ?? na}-${custom.axisSoftMax ?? na}`,
    custom.axisPlacement ?? AxisPlacement.Auto,
    distribution ? `${distribution.type}${distribution.type === 'log' ? distribution.log : ''}` : 'linear',
    custom.axisLabel || na,
    type,
  ].join('/');
}

/** `field.config.custom`, which `@grafana/data` types as `any`. */
function customOf(field: Field): GraphFieldConfig {
  const custom: unknown = field.config.custom;
  return isObject(custom) ? custom : {};
}

function isObject(value: unknown): value is GraphFieldConfig {
  return typeof value === 'object' && value !== null;
}

/** The value when it is a finite number. */
function finite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
