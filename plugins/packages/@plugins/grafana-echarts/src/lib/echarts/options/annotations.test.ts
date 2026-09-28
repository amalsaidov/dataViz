import {
  ANNOTATION_SERIES_ID,
  buildAnnotationSeries,
  buildCategoryAnnotationSeries,
} from 'lib/echarts/options/annotations';

const range = { min: 1000, max: 2000 };
const line = (xAxis: number, color: string) => ({ xAxis, lineStyle: { color, width: 2, type: [5, 5] } });

describe('buildAnnotationSeries', () => {
  it('draws a dashed line for a point', () => {
    const series = buildAnnotationSeries([{ time: 1200, color: 'red' }], range);
    expect(series?.markLine?.data).toEqual([line(1200, 'red')]);
    expect(series?.markArea?.data).toEqual([]);
  });

  it('draws a line at each edge of a region and a band between them', () => {
    const series = buildAnnotationSeries([{ time: 1200, timeEnd: 1500, color: 'blue' }], range);
    expect(series?.markLine?.data).toEqual([line(1200, 'blue'), line(1500, 'blue')]);
    expect(series?.markArea?.data).toEqual([
      [{ xAxis: 1200, itemStyle: { color: 'blue', opacity: 0.1 } }, { xAxis: 1500 }],
    ]);
  });

  it('is a named line series with no data and no hover', () => {
    const series = buildAnnotationSeries([{ time: 1200, color: 'red' }], range, 3);
    expect(series).toMatchObject({
      id: ANNOTATION_SERIES_ID,
      name: ANNOTATION_SERIES_ID,
      type: 'line',
      data: [],
      silent: true,
      zlevel: 3,
    });
  });

  it('drops points out of the axis range', () => {
    expect(
      buildAnnotationSeries(
        [
          { time: 999, color: 'red' },
          { time: 2001, color: 'red' },
        ],
        range
      )
    ).toBeUndefined();
  });

  it('clips a region to the axis range and draws no line at a clipped edge', () => {
    const series = buildAnnotationSeries([{ time: 500, timeEnd: 1500, color: 'blue' }], range);
    expect(series?.markLine?.data).toEqual([line(1500, 'blue')]);
    expect(series?.markArea?.data).toEqual([
      [{ xAxis: 1000, itemStyle: { color: 'blue', opacity: 0.1 } }, { xAxis: 1500 }],
    ]);
  });

  it('drops a region out of the axis range', () => {
    expect(buildAnnotationSeries([{ time: 2100, timeEnd: 2500, color: 'blue' }], range)).toBeUndefined();
  });

  it('returns nothing when there are no marks', () => {
    expect(buildAnnotationSeries([], range)).toBeUndefined();
  });
});

describe('buildCategoryAnnotationSeries', () => {
  // Four categories, 100 ms apart.
  const categoryTimes = [1000, 1100, 1200, 1300];

  it('moves a point to the index of the nearest category', () => {
    const series = buildCategoryAnnotationSeries(
      [
        { time: 1100, color: 'red' },
        { time: 1140, color: 'red' },
        { time: 1160, color: 'red' },
      ],
      categoryTimes
    );
    expect(series?.markLine?.data).toEqual([line(1, 'red'), line(1, 'red'), line(2, 'red')]);
  });

  it('moves a point halfway between two categories to the earlier category', () => {
    const series = buildCategoryAnnotationSeries([{ time: 1150, color: 'red' }], categoryTimes);
    expect(series?.markLine?.data).toEqual([line(1, 'red')]);
  });

  it('draws a region between the indexes of its edges', () => {
    const series = buildCategoryAnnotationSeries([{ time: 1010, timeEnd: 1290, color: 'blue' }], categoryTimes);
    expect(series?.markLine?.data).toEqual([line(0, 'blue'), line(3, 'blue')]);
    expect(series?.markArea?.data).toEqual([[{ xAxis: 0, itemStyle: { color: 'blue', opacity: 0.1 } }, { xAxis: 3 }]]);
  });

  it('drops points out of the categories, and clips a region with no line at the clipped edge', () => {
    const series = buildCategoryAnnotationSeries(
      [
        { time: 999, color: 'red' },
        { time: 1301, color: 'red' },
        { time: 900, timeEnd: 1200, color: 'blue' },
      ],
      categoryTimes
    );
    expect(series?.markLine?.data).toEqual([line(2, 'blue')]);
    expect(series?.markArea?.data).toEqual([[{ xAxis: 0, itemStyle: { color: 'blue', opacity: 0.1 } }, { xAxis: 2 }]]);
  });

  it('returns nothing when the axis has no categories', () => {
    expect(buildCategoryAnnotationSeries([{ time: 1000, color: 'red' }], [])).toBeUndefined();
  });
});
