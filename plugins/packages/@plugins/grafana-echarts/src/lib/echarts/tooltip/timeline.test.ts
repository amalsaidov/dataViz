import { FieldType, toDataFrame } from '@grafana/data';
import { type TopLevelFormatterParams } from 'echarts/types/dist/shared';
import { buildTimelineTooltipModel, type TimelineItem } from './timeline';

const field = toDataFrame({ fields: [{ name: 'state', type: FieldType.string, values: ['OK'] }] }).fields[0];
const items: TimelineItem[] = [
  {
    laneIndex: 0,
    lane: { name: 'server A', field, lineWidth: 0, segments: [] },
    segment: {
      start: Date.UTC(2026, 0, 1, 10, 0),
      end: Date.UTC(2026, 0, 1, 11, 5),
      text: 'OK',
      color: 'green',
      fillColor: 'green',
      textColor: 'white',
      rowIndex: 3,
    },
  },
];

describe('buildTimelineTooltipModel', () => {
  it('shows start - end, the lane value with its swatch, and the duration', () => {
    const model = buildTimelineTooltipModel(items, { timeZone: 'utc' })({ dataIndex: 0 } as TopLevelFormatterParams);
    expect(model.header).toEqual({ label: '', value: '2026-01-01 10:00:00 - \n2026-01-01 11:05:00' });
    expect(model.rows).toEqual([
      { color: 'green', label: 'server A', value: 'OK', source: { field, rowIndex: 3 } },
      { label: 'Duration', value: '1h 5m' },
    ]);
    expect(model.source).toEqual({ field, rowIndex: 3 });
  });
});
