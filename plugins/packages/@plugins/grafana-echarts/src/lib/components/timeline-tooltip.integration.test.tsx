import { SortOrder, TooltipDisplayMode } from '@grafana/schema';
import { type EChartsType } from 'echarts';
import { defaultTimeRange } from 'test/panel';
import { stringsFrame, statusGridFrame, timelineCanvasOptions } from 'test/timelineCanvas';
import { dispatch, renderTooltipPanel, tooltipText } from 'test/tooltipPointer';
import { type ChartFamily } from 'lib/echarts/charts/autoSeriesType';

// The timeline tooltip modes, driven through zrender's real pointer pipeline (see
// `test/tooltipPointer.tsx`). The All tooltip lists each lane at the hovered time,
// as core's `StateTimelineTooltip` in Multi mode.

const renderPanel = (mode: TooltipDisplayMode, family: ChartFamily = 'timeline', frame = stringsFrame()) =>
  renderTooltipPanel({
    frames: [frame],
    seriesType: 'custom',
    family,
    options: timelineCanvasOptions({ tooltip: { mode, sort: SortOrder.None } }),
  });

/** Hover lane A, 10 minutes after the first row: lane A is OK, lane B is ERROR there. */
const hoverFirstRow = async (chart: EChartsType) => {
  const time = defaultTimeRange.from.valueOf() + 10 * 60 * 1000;
  const [x, y] = chart.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [time, 0.2]);
  await dispatch(chart, 'mousemove', x, y);
};

describe('state timeline tooltip', () => {
  it('lists the state of each lane at the hovered time in the All tooltip', async () => {
    const chart = await renderPanel(TooltipDisplayMode.Multi);
    await hoverFirstRow(chart);
    expect(tooltipText()).toContain('server A');
    expect(tooltipText()).toContain('OK');
    expect(tooltipText()).toContain('server B');
    expect(tooltipText()).toContain('ERROR');
  });

  it('lists only the hovered bar in the Single tooltip', async () => {
    const chart = await renderPanel(TooltipDisplayMode.Single);
    await hoverFirstRow(chart);
    expect(tooltipText()).toContain('server A');
    expect(tooltipText()).not.toContain('server B');
  });
});

describe('status history tooltip', () => {
  it('lists the cell of each lane at the hovered time in the All tooltip', async () => {
    const chart = await renderPanel(TooltipDisplayMode.Multi, 'status-history', statusGridFrame());
    await hoverFirstRow(chart);
    for (const lane of ['api', 'db', 'cache']) {
      expect(tooltipText()).toContain(lane);
    }
  });
});
