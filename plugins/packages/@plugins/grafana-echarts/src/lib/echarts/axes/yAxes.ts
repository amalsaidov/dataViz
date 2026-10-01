import { type Field, type GrafanaTheme2, type ValueFormatter } from '@grafana/data';
import { AxisColorMode, AxisPlacement, type GraphFieldConfig, ScaleDistribution } from '@grafana/schema';
import { type TimeAxisBaseOption } from 'echarts/types/src/coord/axisCommonTypes';
import { type CartesianAxisOption, type YAXisOption } from 'echarts/types/src/coord/cartesian/AxisModel';
import { AXIS_FONT_SIZE } from 'lib/echarts/options/base';
import { type AxisRange, type CartesianYAxes } from 'lib/echarts/axes/types';
import { mergeAxisStyle } from 'lib/echarts/options/cartesian';
import { getValueFormatter } from 'lib/echarts/style';
import { getFieldConfigFromField, getFieldMinMax } from 'lib/grafana/fields/fieldConfig';

/** Horizontal gap (px) between stacked axes sharing a side. */
export const AXIS_OFFSET_STEP = 50;
/** Space (px) an axis name ("Axis > Label") takes beside the tick labels. */
export const AXIS_NAME_SPACE = 20;
/** Unit group of the stacked fields in percent stacking: they share one percent axis. */
const PERCENT_GROUP = '\0percent';

type Side = 'left' | 'right';

/** Undefined/empty units collapse into one default group. */
const unitOf = (field: Field) => getFieldConfigFromField(field).unit ?? '';

/**
 * Unit group of a field: its unit, or the shared percent group. A field that does not stack goes on the
 * percent axis when a stacked field has its unit, because core gives one scale to each unit
 * (`buildScaleKey` in
 * https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/uPlot/internal.ts).
 */
function unitGroupOf(field: Field, percentFields: Set<Field> | undefined): string {
  if (percentFields?.has(field)) {
    return PERCENT_GROUP;
  }
  const unit = unitOf(field);
  return percentFields && [...percentFields].some((stacked) => unitOf(stacked) === unit) ? PERCENT_GROUP : unit;
}

/** Group fields by unit, preserving first-appearance order. */
function groupFieldsByUnit(
  fields: Field[],
  percentFields: Set<Field> | undefined
): { units: string[]; byUnit: Map<string, Field[]> } {
  const units: string[] = [];
  const byUnit = new Map<string, Field[]>();
  for (const field of fields) {
    const unit = unitGroupOf(field, percentFields);
    const group = byUnit.get(unit);
    if (group) {
      group.push(field);
    } else {
      byUnit.set(unit, [field]);
      units.push(unit);
    }
  }
  return { units, byUnit };
}

/**
 * Resolve a unit group's placement: the first field with an explicit (non-auto)
 * placement wins, otherwise `Auto`. Fields sharing a unit share one axis, so a
 * single placement is chosen for the group.
 */
function resolveGroupPlacement(fields: Field[]): AxisPlacement {
  for (const field of fields) {
    const placement = getFieldConfigFromField(field).custom?.axisPlacement;
    if (placement != null && placement !== AxisPlacement.Auto) {
      return placement;
    }
  }
  return AxisPlacement.Auto;
}

/**
 * Side of the axis of each field, with the placement rules of `buildCartesianYAxes`. The legend uses it:
 * core shows "(right y-axis)" for an item on the right axis (`yAxis: 2` in `PlotLegend`,
 * https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/uPlot/PlotLegend.tsx,
 * and `LegendTableItem` in
 * https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/VizLegend/VizLegendTableItem.tsx).
 */
export function getFieldAxisSides(fields: Field[]): Array<Side | 'hidden'> {
  const { units, byUnit } = groupFieldsByUnit(fields, undefined);
  const sideOf = new Map(
    units.map((unit, groupIndex) => {
      const placement = resolveGroupPlacement(byUnit.get(unit) ?? []);
      const side: Side | 'hidden' =
        placement === AxisPlacement.Hidden
          ? 'hidden'
          : placement === AxisPlacement.Left
            ? 'left'
            : placement === AxisPlacement.Right || groupIndex > 0
              ? 'right'
              : 'left';
      return [unit, side];
    })
  );
  return fields.map((field) => sideOf.get(unitOf(field)) ?? 'left');
}

/**
 * Build one y-axis per distinct field unit and map each series (field) to its
 * axis. Placement rules mirror core Grafana:
 * - `Auto`: the first unit renders on the left, additional units on the right.
 * - `Left`/`Right`: force the side.
 * - `Hidden`: the axis is not drawn but the series still plots against it.
 *
 * Axes sharing a side are offset so they don't overlap, and only the first
 * visible axis draws grid split lines to avoid a cluttered grid.
 *
 * When `fields` is empty (e.g. multi-value candlestick/boxplot) a single axis is
 * returned using `fallbackFormatter`, preserving the pre-multi-axis behavior.
 * https://echarts.apache.org/en/option.html#yAxis
 */
export function buildCartesianYAxes(params: {
  fields: Field[];
  baseYAxis: YAXisOption;
  axisStyle: CartesianAxisOption | TimeAxisBaseOption;
  theme: GrafanaTheme2;
  timeZone?: string;
  fallbackFormatter: ValueFormatter;
  zlevel?: number;
  /**
   * Side that `Auto`-placed unit groups resolve to. Defaults to the core Grafana
   * rule (first unit left, the rest right). The heatmap overlay passes `right`
   * so its axes don't collide with the bucket axis pinned to the left.
   */
  autoSide?: Side;
  /**
   * Axes already occupying each side before these are laid out, so offsets and
   * grid spacing account for them. The heatmap passes `initialLeftCount: 1` for
   * its bucket axis, pushing any overlay left axis outboard of it.
   */
  initialLeftCount?: number;
  initialRightCount?: number;
  /** Fields drawn as bars. Their axis includes zero unless a min or max is set, as core Bar chart. */
  barFields?: Set<Field>;
  /**
   * Stacked fields in percent stacking. They share one axis from 0% to 100%. The axis grows to show
   * the fields that do not stack and have the unit of a stacked field.
   */
  percentFields?: Set<Field>;
  /** Horizontal bars: the value axes lie along x, `left` draws at the bottom and `right` at the top. */
  horizontal?: boolean;
  /** Series color of each field, for "Axis > Color: Series". */
  colorOf?: (field: Field) => string | undefined;
}): CartesianYAxes {
  const {
    fields,
    baseYAxis,
    axisStyle,
    theme,
    timeZone,
    fallbackFormatter,
    zlevel,
    autoSide,
    initialLeftCount = 0,
    initialRightCount = 0,
    barFields,
    percentFields,
    horizontal = false,
    colorOf,
  } = params;

  if (fields.length === 0) {
    const yAxis = mergeAxisStyle<YAXisOption>(baseYAxis, axisStyle, { zlevel }, fallbackFormatter);
    return { yAxis: [yAxis], seriesYAxisIndex: [], leftAxisCount: 1, rightAxisCount: 0 };
  }

  const { units, byUnit } = groupFieldsByUnit(fields, percentFields);
  const unitAxisIndex = new Map(units.map((unit, index) => [unit, index]));

  let leftAxisCount = initialLeftCount;
  let rightAxisCount = initialRightCount;
  let leftNameCount = 0;
  let rightNameCount = 0;
  let splitLineAssigned = initialLeftCount > 0 || initialRightCount > 0;

  const yAxis = units.map((unit, groupIndex) => {
    const groupFields = byUnit.get(unit) ?? [];
    const placement = resolveGroupPlacement(groupFields);
    const hidden = placement === AxisPlacement.Hidden;

    let side: Side;
    if (placement === AxisPlacement.Left) {
      side = 'left';
    } else if (placement === AxisPlacement.Right) {
      side = 'right';
    } else {
      // Auto (and hidden): use the caller's override, else first unit left, the
      // rest right (core Grafana's dual-axis default).
      side = autoSide ?? (groupIndex === 0 ? 'left' : 'right');
    }

    // Only visible axes take up grid space / an offset slot.
    let offset = 0;
    if (!hidden) {
      if (side === 'left') {
        offset = leftAxisCount * AXIS_OFFSET_STEP;
        leftAxisCount++;
      } else {
        offset = rightAxisCount * AXIS_OFFSET_STEP;
        rightAxisCount++;
      }
    }

    const showSplitLine = !hidden && !splitLineAssigned;
    if (showSplitLine) {
      splitLineAssigned = true;
    }

    const representative = groupFields[0];
    const percent = unit === PERCENT_GROUP;
    const formatter = getValueFormatter(
      percent
        ? { ...representative, display: undefined, config: { ...representative.config, unit: 'percentunit' } }
        : representative,
      theme,
      timeZone
    );
    // Explicit standard-option Min/Max pin the axis; `scale: true` (from the base
    // axis) still auto-fits any side left unset. Read from the group's
    // representative field, as the formatter/placement above.
    const custom: GraphFieldConfig = getFieldConfigFromField(representative).custom ?? {};
    const range = getAxisRange({
      ...getFieldMinMax(representative),
      custom,
      includeZero: groupFields.some((field) => barFields?.has(field)),
      percent: percent ? (groupFields.every((field) => percentFields?.has(field)) ? 'fixed' : 'soft') : false,
    });
    const color = custom.axisColorMode === AxisColorMode.Series ? colorOf?.(representative) : undefined;
    const name = !hidden && custom.axisLabel ? custom.axisLabel : undefined;
    if (name) {
      side === 'left' ? leftNameCount++ : rightNameCount++;
    }
    const extras: CartesianAxisOption = {
      position: horizontal ? (side === 'left' ? 'bottom' : 'top') : side,
      offset,
      zlevel,
      ...range,
      splitLine: { show: custom.axisGridShow ?? showSplitLine },
      // "Show border" draws the axis line, and its ticks, in the axis color (core `UPlotAxisBuilder`).
      ...(custom.axisBorderShow
        ? {
            axisLine: { show: true, lineStyle: { color: color ?? theme.colors.text.primary } },
            axisTick: { show: true, lineStyle: { color: color ?? theme.colors.text.primary } },
          }
        : {}),
      ...(name
        ? {
            name,
            nameLocation: 'middle',
            nameGap: horizontal ? 25 : 45,
            nameRotate: horizontal ? 0 : side === 'left' ? 90 : -90,
            nameTextStyle: {
              color: color ?? theme.colors.text.primary,
              fontFamily: theme.typography.fontFamily,
              fontSize: AXIS_FONT_SIZE,
            },
          }
        : {}),
      ...(hidden
        ? {
            axisLabel: { show: false },
            axisTick: { show: false },
          }
        : {
            axisLabel: {
              ...(color ? { color } : {}),
              ...(custom.axisWidth ? { width: custom.axisWidth, overflow: 'truncate' } : {}),
            },
          }),
    };

    return mergeAxisStyle<YAXisOption>(baseYAxis, axisStyle, extras, formatter);
  });

  const seriesYAxisIndex = fields.map((field) => unitAxisIndex.get(unitGroupOf(field, percentFields)) ?? 0);

  return { yAxis, seriesYAxisIndex, leftAxisCount, rightAxisCount, leftNameCount, rightNameCount };
}

/**
 * Value axis range and scale from the core axis options, as core Bar chart and
 * Time series. Explicit Min/Max pin the ends. "Soft min/max" extend the data
 * range to include them. "Centered zero" makes the range symmetric around 0. A
 * bar axis includes zero (core Bar chart sets a soft min and max of 0). A percent axis is 0% to 100%.
 * With fields that do not stack, 0% and 100% are soft limits, as the core `UPlotScaleBuilder` for
 * `StackingMode.Percent`. Else
 * ECharts fits the data (`scale: true` from the base axis). "Scale:
 * Logarithmic" makes a log axis, without soft limits (as core); symlog draws linear, ECharts has no symlog axis.
 * https://echarts.apache.org/en/option.html#yAxis.min
 * https://echarts.apache.org/en/option.html#yAxis.type
 */
export function getAxisRange(params: {
  min?: number;
  max?: number;
  custom: GraphFieldConfig;
  includeZero: boolean;
  /** `fixed`: only stacked fields, `soft`: also fields that do not stack, `false`: no percent axis. */
  percent: 'fixed' | 'soft' | false;
}): AxisRange {
  const { custom, includeZero, percent } = params;
  const log = custom.scaleDistribution?.type === ScaleDistribution.Log;
  const logScale = log ? { type: 'log' as const, logBase: custom.scaleDistribution?.log ?? 2 } : {};
  if (percent === 'fixed') {
    return { min: params.min ?? 0, max: params.max ?? 1, scale: false };
  }
  if (percent === 'soft') {
    return {
      min: params.min ?? ((value) => Math.min(value.min, 0)),
      max: params.max ?? ((value) => Math.max(value.max, 1)),
    };
  }
  if (custom.axisCenteredZero && !log) {
    const extent = (value: { min: number; max: number }) => Math.max(Math.abs(value.min), Math.abs(value.max));
    return {
      min: params.min ?? ((value) => -extent(value)),
      max: params.max ?? ((value) => extent(value)),
    };
  }
  // Core `UPlotScaleBuilder` ignores soft limits on a log scale: `uPlot.rangeLog` fits the data only.
  const softMin = log ? undefined : custom.axisSoftMin;
  const softMax = log ? undefined : custom.axisSoftMax;
  const min = params.min ?? (softMin != null ? (value: { min: number }) => Math.min(value.min, softMin) : undefined);
  const max = params.max ?? (softMax != null ? (value: { max: number }) => Math.max(value.max, softMax) : undefined);
  return {
    ...logScale,
    min,
    max,
    // `scale: false` makes ECharts include zero, with nice ticks.
    ...(includeZero && !log ? { scale: false } : {}),
  };
}

/** Extra grid padding (px) needed for offset axes beyond the first on each side. */
export function getAxisGridSpacing(
  axes: Pick<CartesianYAxes, 'leftAxisCount' | 'rightAxisCount' | 'leftNameCount' | 'rightNameCount'>
): {
  left: number;
  right: number;
} {
  return {
    left: Math.max(0, axes.leftAxisCount - 1) * AXIS_OFFSET_STEP + (axes.leftNameCount ?? 0) * AXIS_NAME_SPACE,
    right: Math.max(0, axes.rightAxisCount - 1) * AXIS_OFFSET_STEP + (axes.rightNameCount ?? 0) * AXIS_NAME_SPACE,
  };
}
