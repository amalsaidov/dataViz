import { FieldType, toDataFrame } from '@grafana/data';
import { render, screen } from '@testing-library/react';
import { type SeriesType } from 'editor/types';
import { type ChartFamily } from 'lib/echarts/charts/autoSeriesType';
import React from 'react';
import { getComponent } from 'test/panel';

// Each chart kind shows the Grafana error view, and no chart, for a frame that it cannot draw (#189).

const mockPanelDataErrorView = jest.fn((props: { message?: string }) => (
  <div data-testid="panel-data-error-view">{props.message}</div>
));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  PanelDataErrorView: (props: { message?: string }) => mockPanelDataErrorView(props),
}));

const stringOnly = toDataFrame({
  fields: [{ name: 'label', type: FieldType.string, values: ['a', 'b'] }],
});

const numberOnly = toDataFrame({
  fields: [
    { name: 'a', type: FieldType.number, values: [1, 2] },
    { name: 'b', type: FieldType.number, values: [3, 4] },
  ],
});

const cases: Array<[ChartFamily, SeriesType, typeof stringOnly, Record<string, boolean>]> = [
  ['cartesian', 'line', stringOnly, { needsNumberField: true }],
  ['cartesian', 'bar', stringOnly, { needsNumberField: true }],
  ['cartesian', 'scatter', stringOnly, { needsNumberField: true }],
  ['heatmap', 'heatmap', stringOnly, { needsNumberField: true }],
  ['part-to-whole', 'pie', stringOnly, { needsNumberField: true }],
  ['part-to-whole', 'funnel', stringOnly, { needsNumberField: true }],
  ['multivariate', 'radar', stringOnly, { needsNumberField: true }],
  ['multivariate', 'parallel', stringOnly, { needsNumberField: true }],
  ['hierarchy', 'treemap', stringOnly, { needsNumberField: true }],
  ['hierarchy', 'sunburst', stringOnly, { needsNumberField: true }],
  ['stream', 'themeRiver', numberOnly, { needsTimeField: true }],
  ['cartesian', 'boxplot', numberOnly, {}],
];

describe('data shape issue view', () => {
  beforeEach(() => mockPanelDataErrorView.mockClear());

  it.each(cases)('%s %s shows the error view and no chart', (family, seriesType, frame, needs) => {
    const { container } = render(getComponent([frame], seriesType, {}, {}, {}, family));

    expect(screen.getByTestId('panel-data-error-view')).toBeInTheDocument();
    expect(mockPanelDataErrorView).toHaveBeenCalledWith(expect.objectContaining(needs));
    expect(container.querySelector('canvas')).toBeNull();
  });
});
