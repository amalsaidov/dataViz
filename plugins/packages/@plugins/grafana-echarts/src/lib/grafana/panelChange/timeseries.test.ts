// The adapter of the core Time series panel.
import {
  applyFieldOverrides,
  createTheme,
  DataTopic,
  FieldType,
  getPanelOptionsWithDefaults,
  PanelOptionsEditorBuilder,
  type StandardEditorContext,
  toDataFrame,
} from '@grafana/data';
import type { StackingMode } from '@grafana/schema';
import { getFieldStackId, resolveFieldStack } from 'lib/echarts/converters/fieldOverrides';
import { resolvePanelStacking } from 'lib/echarts/options/bars';

// Fills the registries that Grafana fills before it loads a plugin. It must load before the cartesian module.
import 'test/standardRegistries';
import { plugin as cartesian } from 'modules/cartesian/module';
import { type PanelOptions } from 'types';
import { timeseriesAdapter, timeseriesCapability } from './timeseries';
import type { CorePanel } from './types';

const translate = (panel: Partial<CorePanel>) => timeseriesAdapter.translate({ ...panel, type: 'timeseries' });

/** The leaf paths of an object, as `a.b.c`. */
const leafPaths = (value: unknown, prefix = ''): string[] =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? Object.entries(value).flatMap(([key, child]) => leafPaths(child, prefix === '' ? key : `${prefix}.${key}`))
    : [prefix];

/** A panel that sets each setting that the adapter changes into the cartesian panel. */
const fullPanel: Partial<CorePanel> = {
  options: {
    legend: { showLegend: true, displayMode: 'list', placement: 'bottom', calcs: [] },
    tooltip: { mode: 'multi', sort: 'none' },
    annotations: { multiLane: true },
  },
  fieldConfig: {
    defaults: {
      unit: 'short',
      custom: {
        drawStyle: 'line',
        lineWidth: 2,
        fillOpacity: 10,
        pointSize: 4,
        showPoints: 'always',
        stacking: { group: 'A', mode: 'normal' },
      },
    },
    overrides: [
      {
        matcher: { id: 'byName', options: 'b' },
        properties: [
          { id: 'custom.drawStyle', value: 'points' },
          { id: 'custom.axisPlacement', value: 'right' },
          { id: 'custom.thresholdsStyle', value: { mode: 'line' } },
          { id: 'custom.hideFrom', value: { legend: false, tooltip: false, viz: true } },
          { id: 'color', value: { mode: 'fixed', fixedColor: 'red' } },
          { id: 'custom.stacking', value: { group: 'A', mode: 'none' } },
        ],
      },
    ],
  },
};

describe('timeseriesAdapter.translate', () => {
  it('gives the core default to each missing panel-level setting', () => {
    expect(translate({}).options).toEqual({
      seriesType: 'line',
      lineWidth: 1,
      fillOpacity: 0,
      barFillOpacity: 0,
      pointSize: 5,
      performance: { showPoints: 'auto' },
      // Core draws no value labels by default (#577).
      showValues: 'never',
    });
  });

  it('keeps each present value, also a value that is not the default', () => {
    expect(translate(fullPanel).options).toMatchObject({
      tooltip: { mode: 'multi' },
      annotations: { multiLane: true },
      lineWidth: 2,
      fillOpacity: 10,
      pointSize: 4,
      performance: { showPoints: 'always' },
    });
  });

  it.each([
    ['line', 'line'],
    ['bars', 'bar'],
    ['points', 'scatter'],
  ])('changes drawStyle %s into seriesType %s', (drawStyle, seriesType) => {
    const panel = { fieldConfig: { defaults: { custom: { drawStyle } } } };
    expect(translate(panel).options.seriesType).toBe(seriesType);
  });

  it('changes the override properties into the ids of the cartesian panel', () => {
    expect(translate(fullPanel).fieldConfig.overrides[0].properties).toEqual([
      { id: 'custom.seriesType', value: 'scatter' },
      { id: 'custom.axisPlacement', value: 'right' },
      { id: 'custom.thresholdsStyle.mode', value: 'line' },
      { id: 'custom.hideFrom', value: { legend: false, tooltip: false, viz: true } },
      { id: 'color', value: { mode: 'fixed', fixedColor: 'red' } },
      { id: 'custom.stackSeries', value: false },
      { id: 'custom.stackGroup', value: 'A' },
    ]);
  });

  // #1004: core draws each bar with barWidthFactor of the time interval. The cartesian "Bar width" is a percent of
  // the same interval, so the factor becomes a percent.
  describe('bar width', () => {
    const bars = (custom: Record<string, unknown>) =>
      translate({ fieldConfig: { defaults: { custom: { drawStyle: 'bars', ...custom } } } }).options.barWidth;

    it('changes barWidthFactor into a bar width percent', () => {
      expect(bars({ barWidthFactor: 0.5 })).toBe(50);
    });

    it('gives the core default 0.6 to a missing barWidthFactor', () => {
      expect(bars({})).toBe(60);
    });

    it('sets the bar width when only an override draws bars', () => {
      const panel = {
        fieldConfig: {
          defaults: { custom: { drawStyle: 'line', barWidthFactor: 0.3 } },
          overrides: [
            { matcher: { id: 'byName', options: 'b' }, properties: [{ id: 'custom.drawStyle', value: 'bars' }] },
          ],
        },
      };
      expect(translate(panel).options.barWidth).toBe(30);
    });

    it('writes no bar width when no series draws bars', () => {
      expect(translate({ fieldConfig: { defaults: { custom: { barWidthFactor: 0.5 } } } }).options).not.toHaveProperty(
        'barWidth'
      );
    });
  });

  // #999: core Time series fits a bar axis to the data (`uPlot.rangeNum`). The cartesian default includes zero.
  describe('bar value axis', () => {
    it('sets barsIncludeZero false when a series draws bars', () => {
      expect(translate({ fieldConfig: { defaults: { custom: { drawStyle: 'bars' } } } }).options.barsIncludeZero).toBe(
        false
      );
    });

    it('writes no barsIncludeZero when no series draws bars', () => {
      expect(translate({ fieldConfig: { defaults: { custom: {} } } }).options).not.toHaveProperty('barsIncludeZero');
    });
  });

  describe('stacking', () => {
    const stacking = (mode: string, group = 'A') => ({ group, mode });
    const byName = (name: string, value: unknown) => ({
      matcher: { id: 'byName', options: name },
      properties: [{ id: 'custom.stacking', value }],
    });

    /** The stacking of each field a, b and c, as the cartesian panel reads it after Grafana applies the overrides. */
    const fieldStacks = (panel: Partial<CorePanel>) => stackedFields(panel).stacks;

    /** The stacking of each field and the ECharts stack id of each field, as the cartesian panel reads them. */
    const stackedFields = (panel: Partial<CorePanel>) => {
      const target = translate(panel);
      const [frame] = applyFieldOverrides({
        data: [
          toDataFrame({
            fields: [
              { name: 'time', type: FieldType.time, values: [1] },
              ...['a', 'b', 'c'].map((name) => ({ name, type: FieldType.number, values: [1] })),
            ],
          }),
        ],
        fieldConfig: target.fieldConfig,
        fieldConfigRegistry: cartesian.fieldConfigRegistry,
        replaceVariables: (value) => value,
        theme: createTheme(),
      });
      // `timeSeries.ts` stacks a field with `resolveFieldStack(field, <panel mode is not none>)`.
      const { stacking: mode } = target.options;
      const panelMode = resolvePanelStacking({
        stacking: typeof mode === 'string' ? (mode as StackingMode) : undefined,
      });
      const fields = frame.fields.slice(1);
      return {
        stacks: [panelMode, ...fields.map((field) => resolveFieldStack(field, panelMode !== 'none'))],
        ids: fields.map((field) => getFieldStackId(field, false)),
      };
    };

    // The gdev panel "Stacking groups, data stacked": two groups. Contract 20.2: the group is supported.
    it('stacks the fields of each group apart', () => {
      const panel = {
        fieldConfig: {
          defaults: { custom: { stacking: stacking('none') } },
          overrides: [byName('a', stacking('normal')), byName('b', stacking('normal', 'B'))],
        },
      };
      expect(stackedFields(panel)).toEqual({
        stacks: ['normal', true, true, false],
        ids: ['total-line', 'total-line:B', 'total-line'],
      });
    });

    it('stacks each field in the group of the defaults', () => {
      const panel = { fieldConfig: { defaults: { custom: { stacking: stacking('normal', 'B') } } } };
      expect(stackedFields(panel).ids).toEqual(['total-line:B', 'total-line:B', 'total-line:B']);
    });

    // The cartesian panel has one mode (#488). A field with another mode does not stack with the fields of the
    // panel mode.
    it('stacks a field with another mode apart', () => {
      const panel = {
        fieldConfig: {
          defaults: { custom: { stacking: stacking('normal') } },
          overrides: [byName('c', stacking('percent'))],
        },
      };
      expect(stackedFields(panel)).toEqual({
        stacks: ['normal', true, true, true],
        ids: ['total-line', 'total-line', 'total-line:A:percent'],
      });
    });

    it('stacks a field with another unit apart', () => {
      const panel = {
        fieldConfig: {
          defaults: { custom: { stacking: stacking('normal') } },
          overrides: [{ matcher: { id: 'byName', options: 'c' }, properties: [{ id: 'unit', value: 'percentunit' }] }],
        },
      };
      expect(stackedFields(panel).ids).toEqual(['total-line', 'total-line', 'total-line@percentunit']);
    });

    it('moves a field back to the group A with an override', () => {
      const panel = {
        fieldConfig: {
          defaults: { custom: { stacking: stacking('normal', 'B') } },
          overrides: [byName('c', stacking('normal'))],
        },
      };
      expect(stackedFields(panel).ids).toEqual(['total-line:B', 'total-line:B', 'total-line']);
    });

    it.each(['normal', 'percent'])('changes the defaults mode %s into the panel mode', (mode) => {
      const panel = { fieldConfig: { defaults: { custom: { stacking: stacking(mode) } } } };
      expect(translate(panel).options.stacking).toBe(mode);
      expect(fieldStacks(panel)).toEqual([mode, true, true, true]);
    });

    it('writes no stacking for the mode none', () => {
      const panel = { fieldConfig: { defaults: { custom: { stacking: stacking('none') } } } };
      expect(translate(panel).options).not.toHaveProperty('stacking');
      expect(translate(panel).fieldConfig.defaults.custom).not.toHaveProperty('stackSeries');
      expect(fieldStacks(panel)).toEqual(['none', false, false, false]);
    });

    // The gdev panel "Stacking groups, data stacked": only the overrides stack.
    it('stacks only the fields of an override when the defaults do not stack', () => {
      const panel = {
        fieldConfig: {
          defaults: { custom: { stacking: stacking('none') } },
          overrides: [byName('a', stacking('normal')), byName('b', stacking('normal'))],
        },
      };
      expect(translate(panel).fieldConfig.defaults.custom).toMatchObject({ stackSeries: false });
      expect(fieldStacks(panel)).toEqual(['normal', true, true, false]);
    });

    it('removes a field from the stack with an override of the mode none', () => {
      const panel = {
        fieldConfig: {
          defaults: { custom: { stacking: stacking('percent') } },
          overrides: [byName('c', stacking('none'))],
        },
      };
      expect(fieldStacks(panel)).toEqual(['percent', true, true, false]);
    });

    it('skips an override of custom.stacking that has no mode', () => {
      const panel = { fieldConfig: { overrides: [byName('a', { group: 'A' })] } };
      expect(translate(panel).fieldConfig.overrides).toEqual([]);
      expect(fieldStacks(panel)).toEqual(['none', false, false, false]);
    });
  });

  // Connect null values (#414): the value goes to the same path. A number is a threshold in ms, never `true`.
  it.each([false, true, 3_600_000])('keeps custom.spanNulls %s in the defaults and in an override', (spanNulls) => {
    const panel = {
      fieldConfig: {
        defaults: { custom: { spanNulls } },
        overrides: [
          { matcher: { id: 'byName', options: 'a' }, properties: [{ id: 'custom.spanNulls', value: spanNulls }] },
        ],
      },
    };
    const target = translate(panel);
    expect(target.fieldConfig.defaults.custom.spanNulls).toBe(spanNulls);
    expect(target.fieldConfig.overrides[0].properties).toEqual([{ id: 'custom.spanNulls', value: spanNulls }]);
  });

  it('removes an override that has no property of the cartesian panel', () => {
    const panel = {
      fieldConfig: {
        overrides: [
          { matcher: { id: 'byName', options: 'a' }, properties: [{ id: 'custom.gradientMode', value: 'hue' }] },
        ],
      },
    };
    expect(translate(panel).fieldConfig.overrides).toEqual([]);
  });

  it('gives no reference to a value of the core panel', () => {
    const target = translate(fullPanel);
    expect(target.options.legend).not.toBe(fullPanel.options?.legend);
    expect(target.fieldConfig.overrides[0].matcher).not.toBe(fullPanel.fieldConfig?.overrides?.[0].matcher);
  });

  // The cartesian panel ignores an option or a field config id that it does not register.
  it('writes only options and field config ids that the cartesian panel registers', () => {
    const target = translate(fullPanel);
    const registered = cartesian.fieldConfigRegistry.list().map((item) => item.id);
    const ids = [
      ...target.fieldConfig.overrides.flatMap((override) => override.properties.map((property) => property.id)),
      ...Object.keys(target.fieldConfig.defaults.custom).map((key) => `custom.${key}`),
    ];
    expect(registered).toEqual(expect.arrayContaining(ids));
  });

  // #404: each setting with core parity shows in the Default editor mode.
  it('writes only options that show in the Default editor mode', () => {
    const target = translate(fullPanel);
    const { options } = getPanelOptionsWithDefaults({
      plugin: cartesian,
      currentOptions: target.options,
      currentFieldConfig: target.fieldConfig,
      isAfterPluginChange: false,
    });
    // The annotation options show only with annotation frames, as core. Multi-row needs two of them.
    const annotations = [1, 2].map((time) =>
      toDataFrame({ meta: { dataTopic: DataTopic.Annotations }, fields: [{ name: 'time', values: [time] }] })
    );
    // https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/panel/PanelPlugin.ts
    const builder = new PanelOptionsEditorBuilder<PanelOptions>();
    cartesian.getPanelOptionsSupplier()(builder, { data: [] } as StandardEditorContext<PanelOptions>);
    const shown = builder
      .getItems()
      .filter((item) => item.showIf?.(options as PanelOptions, [], annotations) ?? true)
      .map((item) => item.path);
    const written = leafPaths(target.options).map((path) =>
      shown.some((item) => path === item || path.startsWith(`${item}.`)) ? 'shown' : path
    );
    expect(written.filter((path) => path !== 'shown')).toEqual([]);
  });
});

describe('timeseriesCapability', () => {
  it('gives an entry to each setting that the adapter writes to the cartesian panel', () => {
    const keys = Object.keys(timeseriesCapability.fieldConfig);
    const target = translate(fullPanel);
    const written = Object.keys(target.fieldConfig.defaults).flatMap((key) =>
      key === 'custom' ? Object.keys(target.fieldConfig.defaults.custom).map((child) => `custom.${child}`) : [key]
    );
    expect(keys).toEqual(expect.arrayContaining(written));
  });
});

describe('the Time series change of custom.lineInterpolation', () => {
  const fieldConfigOf = (fieldConfig: CorePanel['fieldConfig']) =>
    timeseriesAdapter.translate({ type: 'timeseries', fieldConfig }).fieldConfig;

  it('keeps a value other than linear in the defaults, and each value of an override', () => {
    const override = {
      matcher: { id: 'byName', options: 'a' },
      properties: [{ id: 'custom.lineInterpolation', value: 'linear' }],
    };
    const fieldConfig = fieldConfigOf({
      defaults: { custom: { lineInterpolation: 'stepBefore' } },
      overrides: [override],
    });

    expect(fieldConfig.defaults.custom.lineInterpolation).toBe('stepBefore');
    expect(fieldConfig.overrides).toEqual([override]);
  });

  it('leaves out linear, the cartesian default, from the defaults', () => {
    const fieldConfig = fieldConfigOf({ defaults: { custom: { lineInterpolation: 'linear' } }, overrides: [] });

    expect(fieldConfig.defaults.custom).not.toHaveProperty('lineInterpolation');
  });
});
