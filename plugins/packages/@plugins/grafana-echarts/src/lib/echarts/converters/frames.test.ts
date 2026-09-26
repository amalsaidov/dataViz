import { type DataFrame, type Field, FieldType, toDataFrame } from '@grafana/data';
import {
  collectTimeSeriesFields,
  findCategoricalFrame,
  framesHaveTimeField,
  joinStackedFieldsOnTime,
  resolveCategoriesFromFrame,
} from 'lib/echarts/converters/frames';

describe('frames utilities', () => {
  const categoricalFrame: DataFrame = {
    length: 2,
    fields: [
      { name: 'label', type: FieldType.string, config: {}, values: ['a', 'b'] },
      { name: 'value', type: FieldType.number, config: {}, values: [1, 2] },
    ],
  };

  const timeFrame: DataFrame = {
    length: 1,
    fields: [
      { name: 'time', type: FieldType.time, config: {}, values: [1000] },
      { name: 'value', type: FieldType.number, config: {}, values: [42] },
    ],
  };

  it('framesHaveTimeField is true when any frame has a time field', () => {
    expect(framesHaveTimeField([timeFrame])).toBe(true);
    expect(framesHaveTimeField([categoricalFrame, timeFrame])).toBe(true);
  });

  it('framesHaveTimeField is false for Numeric (category) frames and ignores the numeric fallback', () => {
    expect(framesHaveTimeField([categoricalFrame])).toBe(false);
    expect(framesHaveTimeField([])).toBe(false);
  });

  it('findCategoricalFrame picks the first frame with a numeric field', () => {
    expect(findCategoricalFrame([categoricalFrame])).toBe(categoricalFrame);
  });

  it('resolveCategories uses string field values', () => {
    expect(resolveCategoriesFromFrame(categoricalFrame)).toEqual(['a', 'b']);
  });

  it('collectTimeSeriesFields skips frames without a time field', () => {
    expect(collectTimeSeriesFields([categoricalFrame])).toEqual([]);
  });

  it('collectTimeSeriesFields collects numeric fields from time-series frames', () => {
    expect(collectTimeSeriesFields([timeFrame]).map((f) => f.name)).toEqual(['value']);
  });
});

describe('joinStackedFieldsOnTime', () => {
  const frame = (name: string, times: number[], values: number[]) =>
    toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: times },
        { name, type: FieldType.number, values },
      ],
    });
  const stacked = (names: string[]) => (field: Field) => names.includes(field.name);

  it('joins the stacked fields of frames with different timestamps onto one time index', () => {
    const [joined, ...rest] = joinStackedFieldsOnTime(
      [frame('A', [1, 2, 3], [10, 20, 30]), frame('B', [2, 3, 4], [5, 6, 7])],
      stacked(['A', 'B'])
    );
    expect(rest).toHaveLength(0);
    expect(joined.fields.map((field) => field.values)).toEqual([
      [1, 2, 3, 4],
      [10, 20, 30, undefined],
      [undefined, 5, 6, 7],
    ]);
  });

  it('keeps an unstacked field on its own timestamps, so it gets no join nulls', () => {
    const line = frame('L', [1.5, 2.5], [8, 9]);
    const [joined, kept] = joinStackedFieldsOnTime(
      [frame('A', [1, 2], [10, 20]), frame('B', [1, 2], [5, 6]), line],
      stacked(['A', 'B'])
    );
    expect(joined.fields.map((field) => field.name)).toEqual(['time', 'A', 'B']);
    expect(kept).toBe(line);
  });

  it('splits a frame with a stacked and an unstacked field', () => {
    const mixed = toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2] },
        { name: 'A', type: FieldType.number, values: [1, 2] },
        { name: 'L', type: FieldType.number, values: [3, 4] },
      ],
    });
    const [joined, kept] = joinStackedFieldsOnTime([mixed, frame('B', [2, 3], [5, 6])], stacked(['A', 'B']));
    expect(joined.fields.map((field) => field.name)).toEqual(['time', 'A', 'B']);
    expect(kept.fields.map((field) => field.name)).toEqual(['time', 'L']);
  });

  it('puts the joined frame at the place of the first stacked frame, in query order', () => {
    const line = frame('L', [1.5], [8]);
    const result = joinStackedFieldsOnTime([line, frame('A', [1], [10]), frame('B', [1], [5])], stacked(['A', 'B']));
    expect(result.map((part) => part.fields.map((field) => field.name))).toEqual([
      ['time', 'L'],
      ['time', 'A', 'B'],
    ]);
  });

  it('passes the frames through when fewer than two frames have stacked fields', () => {
    const frames = [frame('A', [1], [1]), frame('L', [2], [2])];
    expect(joinStackedFieldsOnTime(frames, stacked(['A']))).toBe(frames);
  });
});
