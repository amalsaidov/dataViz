import { createTheme, getDefaultTimeRange, toDataFrame, FieldType } from '@grafana/data';
import { prepareTimeline } from 'lib/grafana/timeline/prepareTimeline';
import { timelineChartModule } from './timeline';
import { type ChartContext } from './types';

jest.mock('lib/grafana/timeline/prepareTimeline', () => {
  const actual = jest.requireActual('lib/grafana/timeline/prepareTimeline');
  return { ...actual, prepareTimeline: jest.fn(actual.prepareTimeline) };
});

const theme = createTheme();
const timeRange = getDefaultTimeRange();

// One panel: its own frames array, as each panel gets from its query.
const panelContext = (): ChartContext =>
  ({
    frames: [
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2] },
          { name: 'state', type: FieldType.string, values: ['a', 'b'] },
        ],
      }),
    ],
    options: {},
    theme,
    timeRange,
  }) as unknown as ChartContext;

describe('timelineChartModule prepare cache', () => {
  beforeEach(() => jest.mocked(prepareTimeline).mockClear());

  it('keeps one entry per panel when two panels render in turn', () => {
    const first = panelContext();
    const second = panelContext();

    timelineChartModule.getDataIssue?.(first);
    timelineChartModule.getDataIssue?.(second);
    timelineChartModule.buildLegendItems(first, []);
    timelineChartModule.buildLegendItems(second, []);

    expect(prepareTimeline).toHaveBeenCalledTimes(2);
  });

  it('prepares again when the time range changes', () => {
    const ctx = panelContext();
    timelineChartModule.getDataIssue?.(ctx);
    timelineChartModule.getDataIssue?.({ ...ctx, timeRange: getDefaultTimeRange() });

    expect(prepareTimeline).toHaveBeenCalledTimes(2);
  });
});
