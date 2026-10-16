// The adapter of the core Time series panel: it changes Time series settings into cartesian panel settings.
// Core panel: https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/time-series/
// Core field config types (`GraphFieldConfig`): https://github.com/grafana/grafana/blob/main/packages/grafana-schema/src/common/common.gen.ts
import type { FieldConfigSource, MatcherConfig } from '@grafana/data';

import capabilityFile from './capabilities/timeseries.json';
import { toCapability } from './capabilityFile';
import type { CoreOverride, CorePanel, ImportAdapter } from './types';

const TARGET = 'grafana-echartscartesian-panel';

/** The standard field options: the cartesian panel keeps all of them (`STANDARD_FIELD_OPTIONS`). */
const STANDARD_KEYS = [
  'color',
  'decimals',
  'displayName',
  'fieldMinMax',
  'filterable',
  'links',
  'mappings',
  'max',
  'min',
  'noValue',
  'thresholds',
  'unit',
];

/**
 * The `custom` keys that the cartesian panel has with the same path and the same values. `spanNulls` is
 * Connect null values: `false`, `true` or a gap threshold in ms (#414, `resolveFieldSpanNulls`).
 */
const PASSTHROUGH_CUSTOM_KEYS = [
  'axisBorderShow',
  'axisCenteredZero',
  'axisColorMode',
  'axisGridShow',
  'axisLabel',
  'axisPlacement',
  'axisSoftMax',
  'axisSoftMin',
  'axisWidth',
  'hideFrom',
  'lineStyle',
  'scaleDistribution',
  'spanNulls',
  'thresholdsStyle',
  'transform',
];

/**
 * The `custom` keys that an override keeps. The defaults of these keys go to the panel options (`translate`).
 * The cartesian panel reads them per field (`resolveFieldStyleOptions`).
 */
const OVERRIDE_CUSTOM_KEYS = [
  ...PASSTHROUGH_CUSTOM_KEYS,
  'lineInterpolation',
  'fillOpacity',
  'lineWidth',
  'pointSize',
  'showPoints',
];

/** The status of each Time series setting, from capabilities/timeseries.json. */
export const timeseriesCapability = toCapability(capabilityFile);

/** The core values for a missing setting. Core: `public/app/plugins/panel/timeseries/config.ts`. */
const CORE_DEFAULTS = { drawStyle: 'line', lineWidth: 1, fillOpacity: 0, pointSize: 5, showPoints: 'auto' };

/** Core `drawStyle` to the cartesian `seriesType`. */
const SERIES_TYPES: Record<string, string> = { line: 'line', bars: 'bar', points: 'scatter' };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A field matcher: https://grafana.com/docs/grafana/latest/panels-visualizations/configure-overrides/ */
const isMatcher = (value: unknown): value is MatcherConfig => isObject(value) && typeof value.id === 'string';

/** The mode of a core `custom.stacking` value (`StackingConfig` of the core field config types), or `undefined`. */
const stackingMode = (value: unknown) => (isObject(value) && typeof value.mode === 'string' ? value.mode : undefined);

/** The group of a core `custom.stacking` value. Core uses the group `A` when it is missing. */
const stackingGroup = (value: unknown) => (isObject(value) && typeof value.group === 'string' ? value.group : 'A');

/** A copy of each present key of `from` in `keys`. */
const pick = (from: Record<string, unknown>, keys: string[]) =>
  Object.fromEntries(keys.filter((key) => from[key] !== undefined).map((key) => [key, structuredClone(from[key])]));

/** The override properties with the same meaning on the cartesian panel. */
const translateProperty = (id: string, value: unknown, panelMode: string): Array<{ id: string; value: unknown }> => {
  // The cartesian panel has one stacking mode for the panel (`stacking`), and a switch (`custom.stackSeries`)
  // and a group (`custom.stackGroup`) for each field. `translate` sets the panel mode. A field with a mode that
  // is not the panel mode gets a group of its own, so it does not stack with the fields of the panel mode.
  if (id === 'custom.stacking') {
    const mode = stackingMode(value);
    if (mode === undefined) {
      return [];
    }
    const group = stackingGroup(value);
    return [
      { id: 'custom.stackSeries', value: mode !== 'none' },
      { id: 'custom.stackGroup', value: mode === 'none' || mode === panelMode ? group : `${group}:${mode}` },
    ];
  }
  const translated = translateOtherProperty(id, value);
  return translated ? [translated] : [];
};

/** An override property other than `custom.stacking` with the same meaning on the cartesian panel, or `undefined`. */
const translateOtherProperty = (id: string, value: unknown) => {
  if (id === 'custom.drawStyle') {
    const seriesType = typeof value === 'string' ? SERIES_TYPES[value] : undefined;
    return seriesType ? { id: 'custom.seriesType', value: seriesType } : undefined;
  }
  // The cartesian panel registers only the mode of `thresholdsStyle`. Grafana skips an unregistered property id.
  if (id === 'custom.thresholdsStyle') {
    const mode = isObject(value) ? value.mode : undefined;
    return mode === undefined ? undefined : { id: 'custom.thresholdsStyle.mode', value: mode };
  }
  const custom = id.startsWith('custom.') ? id.slice('custom.'.length).split('.')[0] : undefined;
  const kept = custom === undefined ? STANDARD_KEYS.includes(id) : OVERRIDE_CUSTOM_KEYS.includes(custom);
  return kept ? { id, value: structuredClone(value) } : undefined;
};

/**
 * The overrides with the properties that the cartesian panel has. The other properties have a diagnostic
 *, or an `ignored` status. An override of `lineWidth`, `fillOpacity`,
 * `pointSize` or `showPoints` is kept: the cartesian panel reads these settings per field.
 */
const translateOverrides = (overrides: CoreOverride[], panelMode: string): FieldConfigSource['overrides'] =>
  overrides.flatMap((override) => {
    const properties = (override.properties ?? []).flatMap((property) =>
      typeof property.id === 'string' ? translateProperty(property.id, property.value, panelMode) : []
    );
    return isMatcher(override.matcher) && properties.length > 0
      ? [{ matcher: structuredClone(override.matcher), properties }]
      : [];
  });

/**
 * The stacking of the cartesian panel. The panel mode is the first mode that is not `none`: the mode of the
 * defaults, else the mode of the first override. If the defaults do not stack, each field that has no override
 * gets `stackSeries: false`. The group of the defaults goes to `stackGroup`. The cartesian panel stacks each group
 * apart, as core. It has one mode for the panel. A field with another mode stacks apart (see `translateProperty`),
 * but it draws with the panel mode. The capability file cannot compare the modes of two fields (#488).
 */
const translateStacking = (custom: Record<string, unknown>, overrides: CoreOverride[]) => {
  const defaultsMode = stackingMode(custom.stacking) ?? 'none';
  const overrideModes = overrides.flatMap((override) =>
    (override.properties ?? [])
      .filter((property) => property.id === 'custom.stacking')
      .map((p) => stackingMode(p.value))
  );
  const mode = [defaultsMode, ...overrideModes].find((value) => value !== undefined && value !== 'none');
  if (mode === undefined) {
    return { mode: 'none', options: {}, custom: {} };
  }
  const group = stackingGroup(custom.stacking);
  return {
    mode,
    options: { stacking: mode },
    custom: {
      ...(defaultsMode === 'none' ? { stackSeries: false } : {}),
      ...(group === 'A' ? {} : { stackGroup: group }),
    },
  };
};

/** The core default of `custom.barWidthFactor`. Core: `public/app/plugins/panel/timeseries/config.ts`. */
const CORE_BAR_WIDTH_FACTOR = 0.6;

/**
 * The cartesian "Bar width" (`barWidth`, a percent) from `custom.barWidthFactor` of the defaults, when the defaults
 * or an override draw bars. Core sizes a bar as the factor times the smallest gap between two points (uPlot
 * `paths.bars` `size`). ECharts sizes a time-axis bar percent from the same gap. The cartesian panel has no bar width
 * for each field, so an override of the factor has the `cosmetic` override status.
 * Core: https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/uPlot/config/UPlotSeriesBuilder.ts
 * uPlot: https://github.com/leeoniya/uPlot/blob/master/src/paths/bars.js
 * ECharts: https://echarts.apache.org/en/option.html#series-bar.barWidth
 */
const translateBarWidth = (custom: Record<string, unknown>, drawsBars: boolean) => {
  if (!drawsBars) {
    return {};
  }
  const factor = typeof custom.barWidthFactor === 'number' ? custom.barWidthFactor : CORE_BAR_WIDTH_FACTOR;
  // The panel option is an integer from 1 to 100.
  return { barWidth: Math.min(100, Math.max(1, Math.round(factor * 100))) };
};

/**
 * The `custom.lineInterpolation` of the defaults (#1035). `linear` is the default of the cartesian panel too, so it
 * is left out. An override keeps each value (`OVERRIDE_CUSTOM_KEYS`). Rendered by `getLineInterpolation`.
 */
const translateLineInterpolation = (custom: Record<string, unknown>) =>
  custom.lineInterpolation === undefined || custom.lineInterpolation === 'linear'
    ? {}
    : { lineInterpolation: custom.lineInterpolation };

/** Makes the cartesian panel from a core Time series panel. It does not change `panel`. */
const translate = (panel: CorePanel) => {
  const defaults = isObject(panel.fieldConfig?.defaults) ? panel.fieldConfig.defaults : {};
  const custom = isObject(defaults.custom) ? defaults.custom : {};
  const options = isObject(panel.options) ? panel.options : {};
  // A missing value takes the core default. A present value is not changed.
  const core = { ...CORE_DEFAULTS, ...pick(custom, Object.keys(CORE_DEFAULTS)) };
  const overrides = Array.isArray(panel.fieldConfig?.overrides) ? panel.fieldConfig.overrides : [];
  const stacking = translateStacking(custom, overrides);
  const drawsBars =
    core.drawStyle === 'bars' ||
    overrides.some((override) =>
      (override.properties ?? []).some((p) => p.id === 'custom.drawStyle' && p.value === 'bars')
    );

  return {
    type: TARGET,
    options: {
      ...pick(options, ['legend', 'tooltip', 'annotations']),
      seriesType: SERIES_TYPES[String(core.drawStyle)] ?? 'line',
      lineWidth: core.lineWidth,
      fillOpacity: core.fillOpacity,
      // Core uses one fill opacity for lines and bars. The cartesian panel reads bars from `barFillOpacity`.
      barFillOpacity: core.fillOpacity,
      pointSize: core.pointSize,
      performance: { showPoints: core.showPoints },
      // Core draws no value labels for `custom.showValues: false`, its default. The cartesian default is `auto`.
      showValues: 'never',
      ...stacking.options,
      ...translateBarWidth(custom, drawsBars),
      // Core Time series fits a bar axis to the data (`uPlot.rangeNum` in `UPlotScaleBuilder`), and does not include
      // zero as core Bar chart does (#999).
      // https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/uPlot/config/UPlotScaleBuilder.ts
      ...(drawsBars ? { barsIncludeZero: false } : {}),
    },
    fieldConfig: {
      defaults: {
        ...pick(defaults, STANDARD_KEYS),
        custom: { ...pick(custom, PASSTHROUGH_CUSTOM_KEYS), ...translateLineInterpolation(custom), ...stacking.custom },
      },
      overrides: translateOverrides(overrides, stacking.mode),
    },
  };
};

export const timeseriesAdapter: ImportAdapter = { capability: timeseriesCapability, translate };
