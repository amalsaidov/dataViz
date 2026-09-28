import { ANNOTATION_MARKER_SERIES_ID, buildAnnotationMarkerSeries } from 'lib/echarts/options/annotationMarkers';
import { type TooltipModel } from 'lib/echarts/tooltip/types';

const range = { min: 1000, max: 2000 };

/** The formatter of the series tooltip, called with a hovered item as ECharts does. */
const hover = (series: ReturnType<typeof buildAnnotationMarkerSeries>, dataIndex: number) => {
  const formatter = series?.tooltip?.formatter;
  if (typeof formatter !== 'function') {
    throw new Error('no tooltip formatter');
  }
  // The formatter only reads `dataIndex` of the hovered item.
  formatter({ dataIndex } as Parameters<typeof formatter>[0], '', () => undefined);
};

describe('buildAnnotationMarkerSeries', () => {
  it('is a named custom series with an item tooltip', () => {
    const series = buildAnnotationMarkerSeries([{ time: 1200, color: 'red' }], range, { zlevel: 3 });
    expect(series).toMatchObject({
      id: ANNOTATION_MARKER_SERIES_ID,
      name: ANNOTATION_MARKER_SERIES_ID,
      type: 'custom',
      clip: false,
      zlevel: 3,
      tooltip: { trigger: 'item' },
    });
  });

  it('gives each mark in the range its start and end, and NaN for the y value', () => {
    const series = buildAnnotationMarkerSeries(
      [
        { time: 1200, color: 'red' },
        { time: 1300, timeEnd: 1500, color: 'blue' },
      ],
      range
    );
    expect(series?.data).toEqual([
      [1200, 1200, NaN],
      [1300, 1500, NaN],
    ]);
  });

  it('drops points out of the range and clips a region to it', () => {
    const series = buildAnnotationMarkerSeries(
      [
        { time: 999, color: 'red' },
        { time: 2001, color: 'red' },
        { time: 500, timeEnd: 1500, color: 'blue' },
        { time: 2100, timeEnd: 2500, color: 'blue' },
      ],
      range
    );
    expect(series?.data).toEqual([[1000, 1500, NaN]]);
  });

  it('returns nothing when no mark is in the range', () => {
    expect(buildAnnotationMarkerSeries([{ time: 3000, color: 'red' }], range)).toBeUndefined();
    expect(buildAnnotationMarkerSeries([], range)).toBeUndefined();
  });

  it('sends the tooltip of the hovered mark by its index in the input', () => {
    const models: TooltipModel[] = [];
    const tooltip = (index: number): TooltipModel => ({ header: { label: '', value: `mark ${index}` }, rows: [] });
    const series = buildAnnotationMarkerSeries(
      [
        { time: 500, color: 'red' },
        { time: 1200, color: 'red' },
      ],
      range,
      { tooltip, sink: (model) => models.push(model) }
    );
    // Data index 0 is the second mark: the first is out of the range.
    hover(series, 0);
    expect(models.map((model) => model.header.value)).toEqual(['mark 1']);
  });
});
