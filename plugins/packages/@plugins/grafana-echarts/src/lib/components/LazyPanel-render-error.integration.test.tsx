import { FieldType, toDataFrame } from '@grafana/data';
import { LegendDisplayMode } from '@grafana/schema';
import { render, screen } from '@testing-library/react';
import { type ChartModule } from 'lib/echarts/charts/types';
import React, { type ReactElement } from 'react';
import { getComponent } from 'test/panel';
import { makeLazyPanel } from './LazyPanel';

// A chart module that throws while the panel renders, for each frame named `bad`.
const mockChartModule: ChartModule = {
  legend: { showLegend: false, displayMode: LegendDisplayMode.List, placement: 'bottom', calcs: [] },
  buildOption: () => null,
  buildLegendItems: () => [],
  getDataIssue: ({ frames }) => {
    if (frames.some((frame) => frame.name === 'bad')) {
      throw new Error('c is undefined');
    }
    return undefined;
  },
};

jest.mock('lib/echarts/charts/registry', () => ({ resolveChartModule: () => mockChartModule }));
jest.mock('lib/components/EChart', () => ({ EChart: () => <div>Chart</div> }));
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  PanelDataErrorView: ({ message }: { message?: string }) => <div>{message}</div>,
}));

const frame = (name: string) => toDataFrame({ name, fields: [{ name: 'value', type: FieldType.number, values: [1] }] });

// The props of the Grafana panel, from the test panel element.
const panelProps = (name: string) =>
  (getComponent([frame(name)], 'line') as ReactElement<{ children: ReactElement }>).props.children.props;

describe('LazyPanel render error', () => {
  it('shows the Grafana error view, and the next data renders the chart again', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const LazyPanel = makeLazyPanel('cartesian');

    const { container, rerender } = render(<LazyPanel {...panelProps('bad')} />);

    expect(await screen.findByText('c is undefined')).toBeInTheDocument();
    expect(container.querySelector('[data-viz-state="error"]')).not.toBeNull();
    expect(consoleError).toHaveBeenCalledWith('ECharts panel render error', expect.any(Error));

    rerender(<LazyPanel {...panelProps('good')} />);

    expect(await screen.findByText('Chart')).toBeInTheDocument();
    expect(container.querySelector('[data-viz-state="error"]')).toBeNull();
    consoleError.mockRestore();
  });
});
