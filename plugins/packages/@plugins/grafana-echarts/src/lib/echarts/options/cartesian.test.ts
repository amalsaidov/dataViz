import {
  createTheme,
  type DataFrame,
  FieldType,
  formattedValueToString,
  getDefaultTimeRange,
  getDisplayProcessor,
  ThresholdsMode,
  toDataFrame,
  type ValueFormatter,
} from '@grafana/data';
import { GraphThresholdsStyleMode } from '@grafana/schema';
import { type CallbackDataParams } from 'echarts/types/dist/shared';
import { seriesTypePath } from 'editor/constants';
import { type CartesianShowValues, type CartesianSingleValueSeriesType } from 'editor/types';
import { cartesianChartModule } from 'lib/echarts/charts/cartesian';
import { type ChartContext } from 'lib/echarts/charts/types';
import {
  ADVANCED_CARTESIAN_DEFAULTS,
  applyCartesianEditorModeDefaults,
  buildCartesianSeries,
  getBarRadius,
  getBarWidth,
  getCartesianAreaStyle,
  getCartesianAxisStyle,
  getCartesianLineStyle,
  getCartesianSymbol,
  getCartesianValueLabel,
  getXTickRotate,
} from 'lib/echarts/options/cartesian';
import { type CartesianSeriesInput } from 'lib/echarts/options/types';
import { type PanelOptions } from 'types';

describe('getCartesianAxisStyle', () => {
  it('uses the dark grid color and theme text/font on a dark theme', () => {
    const theme = createTheme({ colors: { mode: 'dark' } });
    const style = getCartesianAxisStyle(theme);

    expect(style.splitLine.lineStyle.color).toBe('rgba(240, 250, 255, 0.09)');
    expect(style.axisTick.lineStyle.color).toBe('rgba(240, 250, 255, 0.09)');
    expect(style.axisLabel.color).toBe(theme.colors.text.primary);
    expect(style.axisLabel.fontFamily).toBe(theme.typography.fontFamily);
    expect(style.axisLabel.fontSize).toBe(12);
  });

  it('uses the light grid color on a light theme', () => {
    const theme = createTheme({ colors: { mode: 'light' } });
    const style = getCartesianAxisStyle(theme);

    expect(style.splitLine.lineStyle.color).toBe('rgba(0, 10, 23, 0.09)');
  });

  it('hides the axis baseline and shows grid + ticks, matching uPlot defaults', () => {
    const style = getCartesianAxisStyle(createTheme());

    expect(style.axisLine.show).toBe(false);
    expect(style.splitLine.show).toBe(true);
    expect(style.axisTick.show).toBe(true);
    expect(style.axisTick.length).toBe(4);
  });
});

describe('cartesianChartModule threshold overlays', () => {
  const theme = createTheme();
  const formatValue: ValueFormatter = (value) => ({ text: value == null ? '' : String(value) });

  const makeContext = (frames: DataFrame[]): ChartContext<CartesianSingleValueSeriesType> => ({
    frames,
    theme,
    timeZone: 'utc',
    timeRange: getDefaultTimeRange(),
    options: { [seriesTypePath]: 'line' } as PanelOptions,
    seriesType: 'line',
    formatValue,
    replaceVariables: (value: string) => value,
    fieldConfig: { defaults: {}, overrides: [] },
  });

  const seriesArray = (result: unknown): Array<Record<string, unknown>> => {
    const series = (result as { series: unknown }).series;
    return (Array.isArray(series) ? series : [series]) as Array<Record<string, unknown>>;
  };

  // Two numeric fields; only the first requests thresholds. Overlays render once
  // on the shared value axis, so they attach to the first series only.
  const frame = (mode?: GraphThresholdsStyleMode): DataFrame =>
    toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2, 3] },
        {
          name: 'cpu',
          type: FieldType.number,
          values: [10, 50, 90],
          config: {
            displayName: 'cpu',
            custom: mode ? { thresholdsStyle: { mode } } : {},
            thresholds: {
              mode: ThresholdsMode.Absolute,
              steps: [
                { value: -Infinity, color: 'green' },
                { value: 70, color: 'red' },
              ],
            },
          },
        },
        { name: 'mem', type: FieldType.number, values: [20, 30, 40], config: { displayName: 'mem' } },
      ],
    });

  it('attaches threshold marks to the first series only', () => {
    const result = cartesianChartModule.buildOption(makeContext([frame(GraphThresholdsStyleMode.LineAndArea)]), {
      isGrafanaLegend: true,
    });

    const series = seriesArray(result);
    expect(series[0].markLine).toBeDefined();
    expect(series[0].markArea).toBeDefined();
    expect(series[1].markLine).toBeUndefined();
    expect(series[1].markArea).toBeUndefined();
  });

  it('omits threshold marks when the display mode is Off', () => {
    const result = cartesianChartModule.buildOption(makeContext([frame()]), { isGrafanaLegend: true });

    const series = seriesArray(result);
    expect(series[0].markLine).toBeUndefined();
    expect(series[0].markArea).toBeUndefined();
  });
});

describe('cartesianChartModule axis Min/Max', () => {
  const theme = createTheme();
  const formatValue: ValueFormatter = (value) => ({ text: value == null ? '' : String(value) });

  const makeContext = (
    frames: DataFrame[],
    seriesType: CartesianSingleValueSeriesType | 'candlestick' = 'line'
  ): ChartContext =>
    ({
      frames,
      theme,
      timeZone: 'utc',
      timeRange: getDefaultTimeRange(),
      options: { [seriesTypePath]: seriesType } as PanelOptions,
      seriesType,
      formatValue,
      replaceVariables: (value: string) => value,
      fieldConfig: { defaults: {}, overrides: [] },
    }) as ChartContext;

  const firstYAxis = (result: unknown): Record<string, unknown> => {
    const yAxis = (result as { yAxis: unknown }).yAxis;
    return (Array.isArray(yAxis) ? yAxis[0] : yAxis) as Record<string, unknown>;
  };

  it('pins the time-axis value axis to the configured Min/Max', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2, 3] },
        { name: 'cpu', type: FieldType.number, values: [10, 50, 90], config: { min: 0, max: 100 } },
      ],
    });

    const yAxis = firstYAxis(cartesianChartModule.buildOption(makeContext([frame]), { isGrafanaLegend: true }));
    expect(yAxis.min).toBe(0);
    expect(yAxis.max).toBe(100);
  });

  it('pins the category-axis value axis to the configured Min/Max', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'category', type: FieldType.string, values: ['a', 'b', 'c'] },
        { name: 'v', type: FieldType.number, values: [10, 50, 90], config: { min: -10, max: 200 } },
      ],
    });

    const yAxis = firstYAxis(cartesianChartModule.buildOption(makeContext([frame], 'bar'), { isGrafanaLegend: true }));
    expect(yAxis.min).toBe(-10);
    expect(yAxis.max).toBe(200);
  });

  it('pins the multi-value (candlestick) value axis to the configured Min/Max', () => {
    const frame = toDataFrame({
      name: 'BTC',
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2, 3] },
        { name: 'open', type: FieldType.number, values: [10, 18, 22], config: { min: 0, max: 40 } },
        { name: 'high', type: FieldType.number, values: [20, 25, 28] },
        { name: 'low', type: FieldType.number, values: [5, 12, 18] },
        { name: 'close', type: FieldType.number, values: [18, 22, 15] },
      ],
    });

    const yAxis = firstYAxis(
      cartesianChartModule.buildOption(makeContext([frame], 'candlestick'), { isGrafanaLegend: true })
    );
    expect(yAxis.min).toBe(0);
    expect(yAxis.max).toBe(40);
  });

  it('leaves Min/Max unset when not configured', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2, 3] },
        { name: 'cpu', type: FieldType.number, values: [10, 50, 90] },
      ],
    });

    const yAxis = firstYAxis(cartesianChartModule.buildOption(makeContext([frame]), { isGrafanaLegend: true }));
    expect(yAxis.min).toBeUndefined();
    expect(yAxis.max).toBeUndefined();
  });
});

// --- Advanced cartesian option builders (categorical multi-axis parity uplift) ---

describe('getCartesianValueLabel', () => {
  const theme = createTheme();
  const label = (showValues: CartesianShowValues | undefined, seriesType: CartesianSingleValueSeriesType, extra = {}) =>
    getCartesianValueLabel({ showValues, position: undefined, seriesType, ...extra }, theme);

  it('labels bars in Auto mode (the editor default), as core Bar chart, but not lines', () => {
    expect(label('auto', 'bar')).toMatchObject({ show: true });
    expect(label('auto', 'line')).toBeUndefined();
  });

  it('labels every series type in Always mode and none in Never mode', () => {
    expect(label('always', 'line')).toMatchObject({ show: true, position: 'top', color: theme.colors.text.primary });
    expect(label('never', 'bar')).toBeUndefined();
  });

  it('draws no labels when the option is unset (the heatmap overlay has no "Show values")', () => {
    expect(label(undefined, 'bar')).toBeUndefined();
  });

  it('hides the bar labels when the auto font size is too small', () => {
    expect(label('always', 'bar', { fontSize: null })).toBeUndefined();
    expect(label('always', 'bar', { fontSize: 14 })).toMatchObject({ fontSize: 14 });
  });

  it('threads the configured position through', () => {
    expect(
      getCartesianValueLabel({ showValues: 'always', position: 'inside', seriesType: 'bar' }, theme)
    ).toMatchObject({
      show: true,
      position: 'inside',
    });
  });

  it('formats the label with the Grafana value formatter, reading the value of a [time, value] item', () => {
    const display = getDisplayProcessor({ field: { type: FieldType.number, config: { unit: 'ms' } }, theme });
    const format = label('always', 'line', { formatValue: display })?.formatter as (
      params: Partial<CallbackDataParams>
    ) => string;
    expect(format({ value: 1500 })).toBe('1.50 s');
    expect(format({ value: [1783137094497, 1500] })).toBe('1.50 s');
  });

  it('reads precomputed texts by data index', () => {
    const format = label('always', 'bar', { texts: ['a', 'b'] })?.formatter as (
      params: Partial<CallbackDataParams>
    ) => string;
    expect(format({ dataIndex: 1 })).toBe('b');
  });

  it('writes no formatter without a value formatter', () => {
    expect(label('always', 'bar')).not.toHaveProperty('formatter');
  });
});

describe('getBarWidth', () => {
  it('formats a positive width as a percentage', () => {
    expect(getBarWidth(60)).toBe('60%');
  });

  it('omits 0/unset (ECharts auto width)', () => {
    expect(getBarWidth(0)).toBeUndefined();
    expect(getBarWidth(undefined)).toBeUndefined();
  });
});

describe('getBarRadius', () => {
  it('returns a positive radius and omits 0/unset', () => {
    expect(getBarRadius(8)).toBe(8);
    expect(getBarRadius(0)).toBeUndefined();
    expect(getBarRadius(undefined)).toBeUndefined();
  });
});

describe('getCartesianLineStyle', () => {
  it('keeps the color and omits width at unset/≤0', () => {
    expect(getCartesianLineStyle('#111111', undefined)).toEqual({ color: '#111111' });
    expect(getCartesianLineStyle('#111111', 0)).toEqual({ color: '#111111' });
  });

  it('merges a positive width', () => {
    expect(getCartesianLineStyle('#111111', 3)).toEqual({ color: '#111111', width: 3 });
  });
});

describe('getCartesianAreaStyle', () => {
  it('maps a non-zero fill opacity 0–100 to an areaStyle opacity 0–1', () => {
    expect(getCartesianAreaStyle(50)).toEqual({ opacity: 0.5 });
    expect(getCartesianAreaStyle(100)).toEqual({ opacity: 1 });
  });

  it('clamps values above 100', () => {
    expect(getCartesianAreaStyle(150)).toEqual({ opacity: 1 });
  });

  it('returns undefined for 0/unset (a plain line)', () => {
    expect(getCartesianAreaStyle(0)).toBeUndefined();
    expect(getCartesianAreaStyle(undefined)).toBeUndefined();
  });
});

describe('getCartesianSymbol', () => {
  it('returns {} for unset (ECharts default symbol)', () => {
    expect(getCartesianSymbol(undefined)).toEqual({});
  });

  it('hides the points at 0', () => {
    expect(getCartesianSymbol(0)).toEqual({ showSymbol: false });
  });

  it('sets the symbol size for a positive value', () => {
    expect(getCartesianSymbol(8)).toEqual({ symbolSize: 8 });
  });
});

describe('getXTickRotate', () => {
  it('returns {} at 0/unset (horizontal labels)', () => {
    expect(getXTickRotate(0)).toEqual({});
    expect(getXTickRotate(undefined)).toEqual({});
  });

  it('returns the rotate extra for a non-zero angle', () => {
    expect(getXTickRotate(45)).toEqual({ rotate: 45 });
    expect(getXTickRotate(-30)).toEqual({ rotate: -30 });
  });
});

describe('buildCartesianSeries', () => {
  const theme = createTheme();
  const input: CartesianSeriesInput = { name: 'A', data: [1, 2, 3], color: '#111111', zlevel: 3 };

  it('passes the input value formatter to the value label', () => {
    const series = buildCartesianSeries(
      { ...input, formatValue: (value) => ({ text: `${value}`, suffix: ' ms' }) },
      'line',
      { showValues: 'always' } as PanelOptions,
      theme
    );
    const format = (series.label as { formatter: (params: Partial<CallbackDataParams>) => string }).formatter;
    expect(format({ value: 3 })).toBe('3 ms');
  });

  it('applies bar-only geometry (width, fill, border), not line/symbol keys', () => {
    const series = buildCartesianSeries(
      input,
      'bar',
      { barWidth: 60, barRadius: 8, lineWidth: 4, fillOpacity: 50, pointSize: 10 } as PanelOptions,
      theme
    );
    expect(series.type).toBe('bar');
    // Core Bar chart: 80% fill, a solid border at the line width. The value-end
    // radius is set on each data item (see `buildCartesianData`).
    expect(series.itemStyle).toEqual({ color: '#111111cc', borderColor: '#111111', borderWidth: 4 });
    expect(series).toMatchObject({ barWidth: '60%' });
    expect(series).not.toHaveProperty('areaStyle');
    expect(series).not.toHaveProperty('symbolSize');
  });

  it('applies line-only style (width/area/symbol), not bar width/radius', () => {
    const series = buildCartesianSeries(
      input,
      'line',
      { barWidth: 60, barRadius: 8, lineWidth: 4, fillOpacity: 50, pointSize: 10 } as PanelOptions,
      theme
    );
    expect(series.type).toBe('line');
    expect(series).toMatchObject({
      lineStyle: { color: '#111111', width: 4 },
      areaStyle: { opacity: 0.5 },
      symbolSize: 10,
      itemStyle: { color: '#111111' },
    });
    expect(series).not.toHaveProperty('barWidth');
  });

  it('labels bars outside their end in Auto mode and hides overlapping labels', () => {
    const auto = buildCartesianSeries(input, 'bar', { showValues: 'auto' } as PanelOptions, theme);
    expect(auto.label).toMatchObject({ show: true, position: 'outside' });
    expect(auto).toMatchObject({ labelLayout: { hideOverlap: true } });
    const always = buildCartesianSeries(input, 'bar', { showValues: 'always' } as PanelOptions, theme);
    expect(always).not.toHaveProperty('labelLayout');
    const never = buildCartesianSeries(input, 'bar', { showValues: 'never' } as PanelOptions, theme);
    expect(never).not.toHaveProperty('label');
  });

  it('sets showEffectOn for effectScatter', () => {
    const series = buildCartesianSeries(input, 'effectScatter', {} as PanelOptions, theme);
    expect(series).toMatchObject({ type: 'effectScatter', showEffectOn: 'emphasis' });
  });

  it('is color-only for an untouched panel (unchanged render)', () => {
    const series = buildCartesianSeries(input, 'line', {} as PanelOptions, theme);
    expect(series).toEqual({
      name: 'A',
      data: [1, 2, 3],
      zlevel: 3,
      type: 'line',
      itemStyle: { color: '#111111' },
      lineStyle: { color: '#111111' },
    });
  });

  // The Advanced style layer and the density-driven performance layer both write
  // into the same series. These cover where they meet.
  describe('performance composition', () => {
    it('spreads the density-resolved fast-path props', () => {
      const series = buildCartesianSeries(
        { ...input, perf: { showSymbol: false, sampling: 'lttb' } },
        'line',
        {} as PanelOptions,
        theme
      );
      expect(series).toMatchObject({ showSymbol: false, sampling: 'lttb' });
    });

    it('keeps the Point size while the performance layer decides visibility', () => {
      // Size is the style layer's; `showSymbol` is the performance layer's, so a
      // dense chart hides markers that still have an explicit size.
      const series = buildCartesianSeries(
        { ...input, perf: { showSymbol: false } },
        'line',
        { pointSize: 10 } as PanelOptions,
        theme
      );
      expect(series).toMatchObject({ symbolSize: 10, showSymbol: false });
    });

    it('lets an explicit Point size of 0 override the performance layer', () => {
      // `0` is a direct "no markers" request, so it wins over Show points: Always.
      const series = buildCartesianSeries(
        { ...input, perf: { showSymbol: true } },
        'line',
        { pointSize: 0 } as PanelOptions,
        theme
      );
      expect(series).toMatchObject({ showSymbol: false });
      expect(series).not.toHaveProperty('symbolSize');
    });

    it('passes large-mode props through for bar/scatter', () => {
      const series = buildCartesianSeries(
        { ...input, perf: { large: true, largeThreshold: 2000 } },
        'scatter',
        {} as PanelOptions,
        theme
      );
      expect(series).toMatchObject({ large: true, largeThreshold: 2000 });
    });
  });

  // `hover` is the tooltip seam: the time-axis converter opts in, the
  // category-axis one does not (it keeps ECharts' native hit-testing).
  describe('hover seam', () => {
    it('emits triggerEvent and a scaled emphasis marker for symbol types', () => {
      const series = buildCartesianSeries({ ...input, hover: true }, 'line', {} as PanelOptions, theme);
      expect(series).toMatchObject({ triggerEvent: true, emphasis: { focus: 'none', scale: 2 } });
    });

    it('emits triggerEvent but no emphasis marker for bars (no symbol to scale)', () => {
      const series = buildCartesianSeries({ ...input, hover: true }, 'bar', {} as PanelOptions, theme);
      expect(series).toMatchObject({ triggerEvent: true });
      expect(series).not.toHaveProperty('emphasis');
    });

    it('omits both when hover is not requested', () => {
      const series = buildCartesianSeries(input, 'line', {} as PanelOptions, theme);
      expect(series).not.toHaveProperty('triggerEvent');
      expect(series).not.toHaveProperty('emphasis');
    });
  });
});

describe('applyCartesianEditorModeDefaults', () => {
  const withMode = (editorMode: PanelOptions['editorMode'], extra: Partial<PanelOptions> = {}): PanelOptions =>
    ({ editorMode, ...extra }) as PanelOptions;

  it('forces advanced options back to their defaults in Default mode', () => {
    const resolved = applyCartesianEditorModeDefaults(withMode('default', { valueLabelPosition: 'inside' }));
    expect(resolved.valueLabelPosition).toBe(ADVANCED_CARTESIAN_DEFAULTS.valueLabelPosition);
  });

  // Asserted against the default rather than a literal: animation is off by
  // default for every family, so the point is that Default mode *resets* the
  // stored value, whichever way the default points. Mirrors the pie's test.
  it('resets the shared animation option in Default mode', () => {
    const resolved = applyCartesianEditorModeDefaults(withMode('default', { animation: { enabled: true } }));
    expect(resolved.animation).toEqual(ADVANCED_CARTESIAN_DEFAULTS.animation);
  });

  it('keeps the Default-tier showValues (never reset)', () => {
    const resolved = applyCartesianEditorModeDefaults(withMode('default', { showValues: 'always' }));
    expect(resolved.showValues).toBe('always');
  });

  // #404: the options with core parity, or with a core mapping (#130), are Default tier and never reset.
  // Explicit 0 values are kept too: the check is not a truthiness test.
  const coreParity: Partial<PanelOptions> = {
    lineWidth: 0,
    fillOpacity: 40,
    pointSize: 0,
    barWidth: 60,
    barRadius: 4,
    barFillOpacity: 0,
    xTickRotate: -45,
    xTickLabelMaxLength: 8,
    performance: { showPoints: 'never' },
  };
  it.each([undefined, 'default', 'advanced', 'api'] as const)('keeps each core-parity option in %s mode', (mode) => {
    const resolved = applyCartesianEditorModeDefaults(withMode(mode, coreParity));
    expect(resolved).toMatchObject(coreParity);
  });

  it('passes stored advanced values through untouched in Advanced mode', () => {
    const options = withMode('advanced', { valueLabelPosition: 'inside', animation: { enabled: true } });
    expect(applyCartesianEditorModeDefaults(options)).toBe(options);
  });
});

/**
 * The category-axis path derives its field list three times over — the converter
 * (ECharts `series`), `cartesianSeriesFields` (`yAxisIndex`, tooltip value
 * formatters, tooltip field resolver), and the legend builder — and each zips its
 * result against the series index positionally. Multi-frame responses are where
 * they would drift, so these lock the three together.
 */
describe('category-axis series/axis/legend alignment', () => {
  const theme = createTheme();
  const formatValue: ValueFormatter = (value) => ({ text: value == null ? '' : String(value) });

  const makeContext = (frames: DataFrame[]): ChartContext<CartesianSingleValueSeriesType> => ({
    frames,
    theme,
    timeZone: 'utc',
    timeRange: getDefaultTimeRange(),
    options: { [seriesTypePath]: 'bar' } as PanelOptions,
    seriesType: 'bar',
    formatValue,
    replaceVariables: (value: string) => value,
    fieldConfig: { defaults: {}, overrides: [] },
  });

  const seriesOf = (result: unknown): Array<Record<string, unknown>> => {
    const series = (result as { series: unknown }).series;
    return (Array.isArray(series) ? series : [series]) as Array<Record<string, unknown>>;
  };

  // Two frames whose value fields carry *different units*, so each lands on its
  // own y-axis — that makes a misaligned `yAxisIndex` observable.
  const barFrame = (): DataFrame =>
    toDataFrame({
      refId: 'Bar',
      fields: [
        { name: 'label', type: FieldType.string, values: ['x', 'a', 'b'] },
        { name: 'value', type: FieldType.number, values: [5, 8, 30], config: { displayName: 'value', unit: 'ppm' } },
      ],
    });

  const markerFrame = (): DataFrame =>
    toDataFrame({
      refId: 'Marker',
      fields: [
        { name: 'markerLabel', type: FieldType.string, values: ['x', 'a', 'b'] },
        {
          name: 'markerValue',
          type: FieldType.number,
          values: [3, 10, 20],
          config: { displayName: 'markerValue', unit: 'bytes', custom: { seriesType: 'scatter' } },
        },
      ],
    });

  it('renders a scatter overlay from a second query on the categorical bar axis', () => {
    const result = cartesianChartModule.buildOption(makeContext([barFrame(), markerFrame()]), {
      isGrafanaLegend: true,
    });

    expect((result as { xAxis: { type: string; data: unknown } }).xAxis).toMatchObject({
      type: 'category',
      data: ['x', 'a', 'b'],
    });
    expect(seriesOf(result)).toMatchObject([
      { name: 'value', type: 'bar' },
      { name: 'markerValue', type: 'scatter' },
    ]);
  });

  it('pins each frame’s series to its own unit y-axis', () => {
    const result = cartesianChartModule.buildOption(makeContext([barFrame(), markerFrame()]), {
      isGrafanaLegend: true,
    });

    const series = seriesOf(result);
    // Distinct units => two axes, and the two series must not share an index.
    expect(series[0].yAxisIndex).not.toEqual(series[1].yAxisIndex);
  });

  it('resolves the tooltip back to the right field for every series', () => {
    const ctx = makeContext([barFrame(), markerFrame()]);
    const resolveField = cartesianChartModule.getTooltipFieldResolver;
    if (!resolveField) {
      throw new Error('cartesian module must supply a tooltip field resolver');
    }
    const resolve = resolveField(ctx);

    expect(resolve({ seriesIndex: 0, dataIndex: 2 })?.field.name).toBe('value');
    expect(resolve({ seriesIndex: 1, dataIndex: 2 })?.field.name).toBe('markerValue');
  });

  it('formats each series’ tooltip value with its own field unit', () => {
    const ctx = makeContext([barFrame(), markerFrame()]);
    const resolveFormatter = cartesianChartModule.getTooltipValueFormatter;
    if (!resolveFormatter) {
      throw new Error('cartesian module must supply a tooltip value formatter');
    }
    // The resolver maps a hovered item to that series' formatter, which is then
    // applied to the value.
    const resolve = resolveFormatter(ctx);

    // 'ppm' and 'bytes' render differently, so a swapped formatter is visible.
    expect(formattedValueToString(resolve({ seriesIndex: 0 })(30))).toContain('ppm');
    expect(formattedValueToString(resolve({ seriesIndex: 1 })(20))).toContain('B');
  });

  it('builds one legend item per series across every frame, in series order', () => {
    const ctx = makeContext([barFrame(), markerFrame()]);
    const items = cartesianChartModule.buildLegendItems(ctx, []);

    expect(items.map((item) => item.label)).toEqual(['value', 'markerValue']);
    expect(new Set(items.map((item) => item.getItemKey?.())).size).toBe(items.length);
  });
});
