import { type DataFrame, FieldType } from '@grafana/data';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { getComponent } from 'test/panel';

// Records the props of the Grafana error view.
const mockPanelDataErrorView = jest.fn((props: { message?: string }) => (
  <div data-testid="panel-data-error-view">{props.message}</div>
));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  PanelDataErrorView: (props: { message?: string }) => mockPanelDataErrorView(props),
}));

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
  // The frame has no five-number summary, so the panel shows the data error view (#189), not a render error (#867).
  it('shows the data error view and does not throw', () => {
    const { container } = render(getComponent([unnamedFrame], 'boxplot', { animation: { enabled: false } }));
    expect(screen.getByTestId('panel-data-error-view')).toHaveTextContent(
      'A boxplot needs the number fields min, q1, median, q3 and max.'
    );
    // The render error view (PanelRenderErrorView) sets data-viz-state="error"; a throw would show it.
    expect(container.querySelector('[data-viz-state="error"]')).toBeNull();
    expect(container.querySelector('canvas')).toBeNull();
  });
});
