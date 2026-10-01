import { PanelPlugin, type SelectFieldConfigSettings } from '@grafana/data';
import { initPluginTranslations } from '@grafana/i18n';
import { GraphThresholdsStyleMode, GraphTransform } from '@grafana/schema';
import { commonOptionsBuilder, getGraphFieldOptions } from '@grafana/ui';
import {
  cartesianOverrideOptionsWithAuto,
  cartesianSeriesTypeOptionsWithAuto,
  multiValueSeriesTypeOptionsWithAuto,
  stackSeriesName,
  stackSeriesPath,
  thresholdsCategoryName,
  thresholdsStyleModeName,
  thresholdsStyleModePath,
} from 'editor/cartesian';
import { seriesTypePath } from 'editor/constants';
import { type EChartsGraphFieldConfig, type SeriesTypeOption } from 'editor/types';
import { makeLazyPanel } from 'lib/components/LazyPanel';
import { framesLookMultiValue } from 'lib/echarts/converters/multiValueCartesian';
import { addCartesianAnnotationOptions } from 'lib/grafana/editor/cartesian/annotations';
import { addCartesianBarChartOptions } from 'lib/grafana/editor/cartesian/bar-chart';
import { addCartesianBarFillOpacityOptions } from 'lib/grafana/editor/cartesian/bar-fill-opacity';
import { addCartesianBarRadiusOptions } from 'lib/grafana/editor/cartesian/bar-radius';
import { addCartesianBarWidthOptions } from 'lib/grafana/editor/cartesian/bar-width';
import { addCartesianBarsIncludeZeroOptions } from 'lib/grafana/editor/cartesian/bars-include-zero';
import { addCartesianFillOpacityOptions } from 'lib/grafana/editor/cartesian/fill-opacity';
import { addCartesianHistogramFieldConfig, addCartesianHistogramOptions } from 'lib/grafana/editor/cartesian/histogram';
import { addCartesianSeriesStyleFieldConfig } from 'lib/grafana/editor/cartesian/series-style';
import { addCartesianLineWidthOptions } from 'lib/grafana/editor/cartesian/line-width';
import { addCartesianPointSizeOptions } from 'lib/grafana/editor/cartesian/point-size';
import { showIfBarOption, showIfLineOption } from 'lib/grafana/editor/cartesian/series-types';
import { addCartesianLineInterpolationFieldConfig } from 'lib/grafana/editor/cartesian/line-interpolation';
import { addCartesianLineStyleFieldConfig } from 'lib/grafana/editor/cartesian/line-style';
import { addCartesianSpanNullsFieldConfig } from 'lib/grafana/editor/cartesian/span-nulls';
import { addCartesianValueLabelOptions } from 'lib/grafana/editor/cartesian/value-labels';
import { addCartesianXTickLabelOptions } from 'lib/grafana/editor/cartesian/x-tick-labels';
import { addCartesianXTickRotateOptions } from 'lib/grafana/editor/cartesian/x-tick-rotate';
import { describeCommonOptions } from 'lib/grafana/editor/common/describe-common-options';
import { addEditorModeOption } from 'lib/grafana/editor/common/editor-mode';
import { STANDARD_FIELD_OPTIONS } from 'lib/grafana/editor/common/fieldConfig';
import { addCommonLegendAndTooltip } from 'lib/grafana/editor/common/legend-and-tooltip';
import { addPerformanceOptions } from 'lib/grafana/editor/common/performance-options';
import { type PanelOptions } from 'types';
import { cartesianSuggestionsSupplier } from './suggestions';
import { cartesianPanelChangeHandler } from './panelChange';

// Initialize i18n before the option builders below call `t()`. Every module is
// its own webpack entry (see getEntries in .config/bundler/utils.ts), so
// Grafana can load this panel without any other module having run.
declare const __PLUGIN_ID__: string;

initPluginTranslations(__PLUGIN_ID__);

// Cartesian family panel: line/bar/scatter on a time/value grid.
// The family is fixed by this nested plugin's identity, so the panel-level
// picker only offers cartesian render types. Which family fits the data is advertised via the Suggestions
// supplier below.
//
// This panel is cartesian-only: mixing stays within the family via the
// per-field override below (e.g. one field as `bar`, others as `line`).
// Cross-family mixing (e.g. heatmap + line) is reserved for the composite
// heatmap panel, so heatmap frames never route here.
export const plugin = new PanelPlugin<PanelOptions, EChartsGraphFieldConfig>(makeLazyPanel('cartesian'))
  // Standard field config options (Color scheme, Unit, Decimals, Min, Max,
  // Display name, No value, Thresholds, Value mappings, Data links). Grafana
  // includes the full set by default and applies them to every field in
  // `data.series` before the panel renders; here we only customize Color.
  .useFieldConfig({
    standardOptions: STANDARD_FIELD_OPTIONS,
    // Per-field series type override. Combined with Grafana field overrides
    // (by name, regex, type, or query), this lets a single panel mix cartesian
    // types, e.g. drawing one field as `bar` and another as `line`. Unset
    // fields fall back to the panel-level series type.
    useCustomConfig: (builder) => {
      builder.addSelect<SeriesTypeOption, SelectFieldConfigSettings<SeriesTypeOption>>({
        path: seriesTypePath,
        defaultValue: 'Auto',
        name: 'Series type',
        description: 'Sets series renderer (bar, line, scatter)',
        hideFromDefaults: true,
        settings: {
          options: cartesianOverrideOptionsWithAuto,
          allowCustomValue: false,
          isClearable: true,
        },
      });

      // Per-field stack override. Only meaningful when the field renders as a
      // bar, or as a line on a time axis, so it is shown only when this field's
      // Series type override is `bar` or `line`.
      // Grafana field-config `showIf` only sees this field's custom config, not
      // the panel-level series type.
      // No default: Grafana writes a field default into every field, and this
      // override would then always beat the panel-level Stacking option.
      builder.addBooleanSwitch({
        path: stackSeriesPath,
        name: stackSeriesName,
        category: ['Bar chart'],
        description: 'Stack this field with the other stacked series of its type: bar, or line on a time axis.',
        showIf: (config) => config.seriesType === 'bar' || config.seriesType === 'line',
      });

      // Core `custom.stacking.group`: a field stacks only with the fields of the same group. Read back in
      // `getFieldStackId`. No default, as the Stacking switch above.
      // https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/time-series/#stack-series
      builder.addTextInput({
        path: 'stackGroup',
        name: 'Stack group',
        category: ['Bar chart'],
        description: 'Stack this field only with the stacked fields of the same group. Empty is the group A.',
        settings: { placeholder: 'A' },
      });

      // The standard "Axis" field config of core Time series and Bar chart:
      // placement, label, width, grid lines, color, border, scale, centered zero
      // and soft min/max. Read back in `buildCartesianYAxes`. Fields are grouped
      // onto one y-axis per distinct unit, so the first field of a unit sets it.
      // https://grafana.com/developers/plugin-tools/how-to-guides/panel-plugins/custom-panel-option-editors
      commonOptionsBuilder.addAxisConfig(builder, {});

      // Core "Transform: Negative Y": the series draws below zero, and its
      // tooltip and value labels keep the field value. See `isNegativeY`.
      builder.addSelect({
        path: 'transform',
        name: 'Transform',
        category: ['Graph styles'],
        settings: {
          options: [
            {
              value: GraphTransform.NegativeY,
              label: 'Negative Y',
              description: 'Flip the results to negative values on the y axis',
            },
          ],
          isClearable: true,
        },
        hideFromDefaults: true,
      });

      // Core "Line style" of line series: Solid, Dash or Dots.
      addCartesianLineStyleFieldConfig(builder);

      // Core "Connect null values" of line series: Never, Always or a gap threshold.
      addCartesianSpanNullsFieldConfig(builder);

      // Core "Line interpolation" of line series: Linear, Smooth, Step before or Step after.
      addCartesianLineInterpolationFieldConfig(builder);

      // Threshold display (writes the custom `thresholdsStyle.mode` field
      // config; read back in `cartesianThresholdMarks`). The standard Thresholds
      // section already edits the step values; this chooses how they render as
      // ECharts markLine/markArea overlays. Grouped with the standard Thresholds
      // category so it sits beside the steps editor. The option list is Grafana's
      // own `graphFieldOptions.thresholdsDisplayModes` (used by the core time
      // series panel), which already omits the out-of-scope per-value `Series`
      // mode. `getGraphFieldOptions()` is called (rather than the deprecated
      // `graphFieldOptions` constant) so its translated labels load correctly.
      builder.addSelect({
        path: thresholdsStyleModePath,
        name: thresholdsStyleModeName,
        category: [thresholdsCategoryName],
        defaultValue: GraphThresholdsStyleMode.Off,
        settings: {
          options: getGraphFieldOptions().thresholdsDisplayModes,
        },
      });

      // Core Histogram field settings: Stacking, Line width, Fill opacity and Gradient mode.
      addCartesianHistogramFieldConfig(builder);

      // Core Time series Point size and Show points, per field (overrides only).
      addCartesianSeriesStyleFieldConfig(builder);

      // Register the standard `custom.hideFrom` field config ("Hide in area"
      // switches). Required so the legend visibility toggle's `byName` override
      // is applied by Grafana's field-override engine (unregistered override
      // properties are skipped); the chart then strips fields flagged
      // `hideFrom.viz`. See `lib/grafana/fields/seriesConfig.ts`.
      commonOptionsBuilder.addHideFrom(builder);
    },
  })
  .setPanelOptions((builder) => {
    // Editor mode (Default / Advanced) — tiers the editor surface. Registered
    // first so it renders at the top. The core-parity controls below are always
    // shown, including the bar/line geometry, tick rotation and Show points (#404).
    // The ECharts-only options (value-label position, Downsampling, Animation) gate
    // on Advanced via `showIf: isAdvancedEditorMode`. See docs/options-modes.md.
    addEditorModeOption(builder);

    // Panel-level series type: the base render type applied to every field (the
    // per-field override above can still switch individual single-value fields).
    // 'Auto' resolves the best type from the data (see `resolveAutoSeriesType`).
    // Options are data-aware: when the frames are shaped for a multi-value type
    // (candlestick OHLC / boxplot five-number summary) only candlestick/boxplot
    // are offered; otherwise every render type. This is the only
    // control that writes the panel-level `options.seriesType`, so it also lets a
    // provisioned candlestick/boxplot panel switch to another cartesian type.
    builder.addSelect<SeriesTypeOption, SelectFieldConfigSettings<SeriesTypeOption>>({
      path: seriesTypePath,
      name: 'Series type',
      description: 'Base render type for the panel. Auto picks the best fit from the data.',
      defaultValue: 'Auto',

      settings: {
        options: cartesianSeriesTypeOptionsWithAuto,
        getOptions: (context) =>
          Promise.resolve(
            framesLookMultiValue(context.data)
              ? multiValueSeriesTypeOptionsWithAuto
              : cartesianSeriesTypeOptionsWithAuto
          ),
        allowCustomValue: false,
      },
    });

    // Core Bar chart options: Stacking, Orientation, full-area hover highlight
    // and "Color by field".
    addCartesianBarChartOptions(builder);

    // Core Histogram options: the Histogram switch and the bucket options.
    addCartesianHistogramOptions(builder);

    // Value labels — Default-tier "Show values" (Bar-chart parity) + Advanced
    // placement. Rendered by `getCartesianValueLabel`.
    addCartesianValueLabelOptions(builder);

    // Core-parity geometry / style options (Default tier). Each builder omits its
    // ECharts key at the default so untouched panels render identically.
    addCartesianBarWidthOptions(builder); // series.barWidth (bar)
    addCartesianBarRadiusOptions(builder); // itemStyle.borderRadius (bar)
    addCartesianBarsIncludeZeroOptions(builder); // yAxis.scale (bar)
    addCartesianBarFillOpacityOptions(builder); // itemStyle color alpha (bar)
    addCartesianLineWidthOptions(builder); // lineStyle.width (line)
    addCartesianFillOpacityOptions(builder); // areaStyle.opacity (line → area)
    addCartesianPointSizeOptions(builder); // symbolSize / showSymbol (line/scatter)
    addCartesianXTickRotateOptions(builder); // xAxis.axisLabel.rotate
    addCartesianXTickLabelOptions(builder); // xAxis.axisLabel formatter / interval

    // Standard Core Grafana "Legend" (Visibility, Mode, Placement, Width, Limit,
    // Values) + "Tooltip" options, registered in their own categories.
    addCommonLegendAndTooltip(builder);
    // "Text size > Value" sets the bar value label size; unset fits the bars.
    commonOptionsBuilder.addTextSizeOptions(builder, { withTitle: false, withValue: true });
    // Only bar labels read the value size (`converters/cartesianValues.ts`). `addTextSizeOptions` takes no `showIf`.
    const valueSize = builder.getItems().find((item) => item.path === 'text.valueSize');
    if (valueSize) {
      valueSize.showIf = showIfBarOption;
    }
    describeCommonOptions(builder);

    // Performance overrides: Show points (Default tier, core parity), and the
    // Advanced-gated Downsampling / Animation. ECharts' big-data levers are auto-tuned above density
    // thresholds; these let power users override the auto behavior. Cartesian
    // only — the time-series fast path doesn't apply to the other families, which
    // register the shared animation switch on its own via `addAnimationOption`.
    addPerformanceOptions(builder, showIfLineOption);

    // Core "Annotations" options: multi-row markers, and hide the lines and bands.
    addCartesianAnnotationOptions(builder);

    return builder;
  })
  // Advertise fitness for the current data shape (opts in via
  // `"suggestions": true` in plugin.json).
  .setSuggestionsSupplier(cartesianSuggestionsSupplier)
  // Receive the dashboard annotations in `data.annotations`. Without this, a Scenes dashboard
  // removes them before the panel renders (`VizPanel` reads `plugin.dataSupport`).
  // https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/panel/PanelPlugin.ts
  .setDataSupport({ annotations: true })
  // A switch from core Time series keeps its options and field overrides (`panelChange.ts`).
  .setPanelChangeHandler(cartesianPanelChangeHandler);
