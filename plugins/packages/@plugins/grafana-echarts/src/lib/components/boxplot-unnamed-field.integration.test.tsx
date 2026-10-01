import { type DataFrame, FieldType } from '@grafana/data';
import { render } from '@testing-library/react';
import { getComponent } from 'test/panel';

// A malformed frame: its fields have no `name` (#867). The data plane spec expects a name on each field:
// https://grafana.com/developers/dataplane/
const unnamedFrame = {
  length: 2,
  fields: [
    { type: FieldType.string, values: ['a', 'b'], config: {} },
    { type: FieldType.number, values: [1, 2], config: {} },
  ],
} as unknown as DataFrame;

describe('Boxplot: frame with unnamed fields', () => {
  // The frame has no five-number summary, so the chart is empty, as for other frames without one.
  it('renders the chart and not an error view', () => {
    const { container } = render(getComponent([unnamedFrame], 'boxplot', { animation: { enabled: false } }));
    expect(container.querySelector('[_echarts_instance_]')).not.toBeNull();
    expect(container.querySelector('[data-viz-state="error"]')).toBeNull();
  });
});
