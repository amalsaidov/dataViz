import { SortOrder, TooltipDisplayMode } from '@grafana/schema';
import { screen } from '@testing-library/react';
import { type EChartsType } from 'echarts';
import { readLayeredCanvasEvents, SERIES_ZLEVEL } from 'test/canvas';
import { type BarCanvasEvent, categoryFrame, fills } from 'test/barCanvas';
import { dispatch, renderTooltipPanel, tooltipText } from 'test/tooltipPointer';
import { type PanelOptions } from 'types';

// Hover and legend options on category bars (core Bar chart): the All tooltip
// lists every series at the hovered category, "Hide in area" drops a series from
// the tooltip or the legend, and "Highlight full area on hover" draws a band over
// the category. Driven through zrender's real pointer pipeline (see
// `test/tooltipPointer.tsx`), so ECharts' own hit-testing runs.

const frame = (hideB: object = {}) =>
  categoryFrame([
    { name: 'Alpha', values: [10, 20, 30, 40] },
    { name: 'Bravo', values: [30, 20, 10, 40], config: { custom: { hideFrom: { viz: false, ...hideB } } } },
  ]);

const renderPanel = (options: Partial<PanelOptions>, hideB: object = {}) =>
  renderTooltipPanel({
    frames: [frame(hideB)],
    seriesType: 'bar',
    family: 'cartesian',
    options: {
      zLevel: { series: SERIES_ZLEVEL },
      animation: { enabled: false },
      editorMode: 'advanced',
      showValues: 'never',
      ...options,
    },
  });

/** Hover the middle of the first Alpha bar, read off the laid-out bar rather than guessed. */
const hoverFirstBar = async (chart: EChartsType) => {
  // `getModel` is not part of the public typings; see `markPoint` in `test/tooltipPointer.tsx`.
  const model = (chart as unknown as { getModel: () => { getSeriesByIndex: (i: number) => SeriesModel } }).getModel();
  const { x, y, width, height } = model.getSeriesByIndex(0).getData().getItemLayout(0);
  await dispatch(chart, 'mousemove', x + width / 2, y + height / 2);
};

interface SeriesModel {
  getData: () => { getItemLayout: (i: number) => { x: number; y: number; width: number; height: number } };
}

describe('bar hover and legend', () => {
  it('lists every series at the hovered category in the All tooltip', async () => {
    const chart = await renderPanel({ tooltip: { mode: TooltipDisplayMode.Multi, sort: SortOrder.None } });
    await hoverFirstBar(chart);
    expect(tooltipText()).toContain('Alpha');
    expect(tooltipText()).toContain('Bravo');
  });

  it('lists only the hovered bar in the Single tooltip', async () => {
    const chart = await renderPanel({ tooltip: { mode: TooltipDisplayMode.Single, sort: SortOrder.None } });
    await hoverFirstBar(chart);
    expect(tooltipText()).toContain('Alpha');
    expect(tooltipText()).not.toContain('Bravo');
  });

  it('drops a series from the tooltip with "Hide in area: Tooltip"', async () => {
    const chart = await renderPanel(
      { tooltip: { mode: TooltipDisplayMode.Multi, sort: SortOrder.None } },
      { tooltip: true }
    );
    await hoverFirstBar(chart);
    expect(tooltipText()).toContain('Alpha');
    expect(tooltipText()).not.toContain('Bravo');
  });

  it('drops a series from the legend with "Hide in area: Legend", and still draws it', async () => {
    const chart = await renderPanel({}, { legend: true });
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.queryByText('Bravo')).not.toBeInTheDocument();
    expect(chart.getOption().series).toHaveLength(2);
  });

  it('draws a band over the hovered category with "Highlight full area on hover"', async () => {
    const gridFills = async (fullHighlight: boolean) => {
      const chart = await renderPanel({
        tooltip: { mode: TooltipDisplayMode.Single, sort: SortOrder.None },
        fullHighlight,
      });
      await hoverFirstBar(chart);
      chart.getZr().flush();
      return fills(readLayeredCanvasEvents(chart.getDom()).defaultEvents as BarCanvasEvent[]);
    };
    const plain = await gridFills(false);
    const band = [...(await gridFills(true))].filter((fill) => !plain.has(fill));
    // One translucent band fill, which the plain chart never paints.
    expect(band).toHaveLength(1);
    expect(band[0]).toMatch(/^rgba\(.*, 0\.2\)$/);
  });
});
