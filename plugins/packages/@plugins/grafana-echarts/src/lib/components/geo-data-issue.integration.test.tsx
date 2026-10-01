import { FieldType, toDataFrame } from '@grafana/data';
import { render, screen } from '@testing-library/react';
import { registerGeoChart } from 'lib/echarts/geo/chart';
import React from 'react';
import { getComponent } from 'test/panel';

// The geo panel shows the Grafana error view, and no map, for a frame with no location field (#864).

const mockPanelDataErrorView = jest.fn((props: { message?: string }) => (
  <div data-testid="panel-data-error-view">{props.message}</div>
));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  PanelDataErrorView: (props: { message?: string }) => mockPanelDataErrorView(props),
}));

registerGeoChart();

const frames = {
  'string only': toDataFrame({ fields: [{ name: 'city', type: FieldType.string, values: ['a', 'b'] }] }),
  'number only': toDataFrame({ fields: [{ name: 'value', type: FieldType.number, values: [1, 2] }] }),
  'time series': toDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: [1, 2] },
      { name: 'value', type: FieldType.number, values: [1, 2] },
    ],
  }),
  'no field names': toDataFrame({
    fields: [{ name: undefined as unknown as string, type: FieldType.number, values: [1, 2] }],
  }),
};

describe('geo data issue view', () => {
  beforeEach(() => mockPanelDataErrorView.mockClear());

  it.each(Object.entries(frames))('%s shows the error view and no map', (_, frame) => {
    const { container } = render(getComponent([frame], 'map', {}, {}, {}, 'geo'));

    expect(screen.getByTestId('panel-data-error-view')).toHaveTextContent('Unable to find location fields');
    expect(container.querySelector('[data-viz-state="error"]')).not.toBeNull();
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('a frame with location fields shows no error view', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'lat', type: FieldType.number, values: [1, 2] },
        { name: 'lon', type: FieldType.number, values: [3, 4] },
      ],
    });
    render(getComponent([frame], 'map', {}, {}, {}, 'geo'));

    expect(screen.queryByTestId('panel-data-error-view')).toBeNull();
  });
});
