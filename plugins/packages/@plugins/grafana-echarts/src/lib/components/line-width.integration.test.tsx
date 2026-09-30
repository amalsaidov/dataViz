import { FieldType, getPanelOptionsWithDefaults, toDataFrame } from '@grafana/data';
import { render } from '@testing-library/react';
import { plugin } from 'modules/cartesian/module';
// Registers the option editors that Grafana registers, so the plugin builder can give its defaults.
import 'standalone/standardRegistries';
import { SERIES_ZLEVEL } from 'test/canvas';
import { getCanvasEvents, getComponent } from 'test/panel';
import { type PanelOptions } from 'types';

// The default "Line width" of a line series as drawn primitives. Grafana applies the plugin option
// defaults before the panel renders, so the test does the same with `getPanelOptionsWithDefaults`.
// The core time series panel draws 1px lines by default:
// https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/time-series/#line-width
const CORE_LINE_WIDTH = 1;

const START = 1783137094497;
const frame = toDataFrame({
  fields: [
    { name: 'time', type: FieldType.time, values: [0, 1, 2, 3].map((i) => START + i * 15 * 60_000) },
    { name: 'cpu', type: FieldType.number, values: [10, 40, 20, 50], config: { displayName: 'cpu' } },
  ],
});

/** The `lineWidth` of each stroked path with a `lineTo`: the lines. Point markers are arcs, so they do not count. */
const strokeWidths = async (options: Partial<PanelOptions>) => {
  const { container, unmount } = render(
    getComponent([frame], 'line', { ...options, zLevel: { series: SERIES_ZLEVEL }, animation: { enabled: false } })
  );
  const { seriesEvents } = await getCanvasEvents(container);
  unmount();
  const widths = new Set<number>();
  let width = 1; // The canvas default.
  let hasLine = false;
  for (const event of seriesEvents) {
    if (event.type === 'lineWidth') {
      width = Number(event.props.value);
    } else if (event.type === 'beginPath') {
      hasLine = false;
    } else if (event.type === 'lineTo') {
      hasLine = true;
    } else if (event.type === 'stroke' && hasLine) {
      widths.add(width);
    }
  }
  return widths;
};

describe('Line width: plugin default', () => {
  it('draws the line with the 1px stroke of the core time series panel', async () => {
    const { options } = getPanelOptionsWithDefaults({
      plugin,
      currentOptions: {},
      currentFieldConfig: { defaults: {}, overrides: [] },
      isAfterPluginChange: false,
    });
    expect(await strokeWidths(options as Partial<PanelOptions>)).toEqual(new Set([CORE_LINE_WIDTH]));
  });

  it('draws a thicker line when the option is set', async () => {
    expect(await strokeWidths({ lineWidth: 4 })).toEqual(new Set([4]));
  });
});
