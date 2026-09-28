import { buildAnnotationTooltipModel } from 'lib/echarts/tooltip/annotation';

describe('buildAnnotationTooltipModel', () => {
  it('shows the time of a point in the full date format, with the title, text and tags', () => {
    const model = buildAnnotationTooltipModel(
      { time: 1783139000000, color: 'red', title: 'Deploy', text: 'v1.2', tags: ['release'] },
      'utc'
    );
    expect(model).toEqual({
      header: { label: '', value: '2026-07-04 04:23:20' },
      rows: [],
      annotation: { title: 'Deploy', text: 'v1.2', tags: ['release'] },
    });
  });

  it('shows the time range of a region, and no tags when the event has none', () => {
    const model = buildAnnotationTooltipModel({ time: 1783139000000, timeEnd: 1783142600000, color: 'red' }, 'utc');
    expect(model.header.value).toBe('2026-07-04 04:23:20 - 2026-07-04 05:23:20');
    expect(model.annotation).toEqual({ tags: [] });
  });
});
