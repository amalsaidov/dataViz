import { type DataFrame, DataFrameType, FieldType, toDataFrame } from '@grafana/data';
import {
  type BinnedHeatmapCell,
  frameToBinnedHeatmap,
  isBinnedHeatmapFrame,
} from 'lib/echarts/converters/binnedHeatmap';

const findCell = (cells: BinnedHeatmapCell[], xStart: number, yStart: number): BinnedHeatmapCell | undefined =>
  cells.find((cell) => cell.xStart === xStart && cell.yStart === yStart);

describe('isBinnedHeatmapFrame', () => {
  it.each([DataFrameType.HeatmapRows, DataFrameType.HeatmapCells])('is true for %s frames', (type) => {
    const frame = toDataFrame({ meta: { type }, fields: [{ name: 'x', type: FieldType.number, values: [1] }] });
    expect(isBinnedHeatmapFrame(frame)).toBe(true);
  });

  it('is false for frames without a heatmap meta type', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [1] },
        { name: 'v', type: FieldType.number, values: [1] },
      ],
    });
    expect(isBinnedHeatmapFrame(frame)).toBe(false);
  });
});

describe('frameToBinnedHeatmap - heatmap-rows', () => {
  const linear = { rowsScale: { type: 'linear' } } as const;
  const rowsFrame = (): DataFrame =>
    toDataFrame({
      meta: { type: DataFrameType.HeatmapRows },
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2] },
        { name: 'b1', type: FieldType.number, values: [5, 6], labels: { le: '10' } },
        { name: 'b2', type: FieldType.number, values: [7, 8], labels: { le: '20' } },
        { name: 'b3', type: FieldType.number, values: [9, 10], labels: { le: '+Inf' } },
      ],
    });

  it('derives bucket bounds from le labels and contiguous lower bounds on a linear scale', () => {
    const result = frameToBinnedHeatmap([rowsFrame()], undefined, linear);
    expect(result).not.toBeNull();

    // 3 buckets x 2 timestamps.
    expect(result!.cells).toHaveLength(6);

    expect(findCell(result!.cells, 1, 0)).toMatchObject({ xStart: 1, xEnd: 2, yStart: 0, yEnd: 10, value: 5 });
    expect(findCell(result!.cells, 1, 10)).toMatchObject({ yStart: 10, yEnd: 20, value: 7 });
    // The +Inf top bucket reuses the previous bucket height (10) so it stays finite.
    expect(findCell(result!.cells, 1, 20)).toMatchObject({ yStart: 20, yEnd: 30, value: 9 });
  });

  it('spans X cells by the smallest timestamp gap', () => {
    const result = frameToBinnedHeatmap([rowsFrame()], undefined, linear);
    expect(findCell(result!.cells, 2, 0)).toMatchObject({ xStart: 2, xEnd: 3 });
  });

  it('reports value and bucket ranges on a linear scale', () => {
    const result = frameToBinnedHeatmap([rowsFrame()], undefined, linear);
    expect(result!.valueMin).toBe(5);
    expect(result!.valueMax).toBe(10);
    expect(result!.yMin).toBe(0);
    expect(result!.yMax).toBe(30);
  });

  it('flags a time X field as a time axis', () => {
    const result = frameToBinnedHeatmap([rowsFrame()], undefined, linear);
    expect(result!.xIsTime).toBe(true);
  });

  it('derives bound-placed bucket labels from le labels on a linear scale', () => {
    const result = frameToBinnedHeatmap([rowsFrame()], undefined, linear);
    expect(result!.yLabelPlacement).toBe('bound');
    expect(result!.yBuckets).toEqual([
      { start: 0, end: 10, label: '10' },
      { start: 10, end: 20, label: '20' },
      { start: 20, end: 30, label: '+Inf' },
    ]);
  });

  it('draws le buckets as equal-height ordinal rows by default (core "Auto")', () => {
    const result = frameToBinnedHeatmap([rowsFrame()]);
    expect(result!.yLabelPlacement).toBe('bound');
    expect(result!.yScale).toBeUndefined();
    expect(result!.yBuckets).toEqual([
      { start: 0, end: 1, label: '10' },
      { start: 1, end: 2, label: '20' },
      { start: 2, end: 3, label: '+Inf' },
    ]);
  });

  it('places le buckets at their bounds on a log scale, with no 0 bound', () => {
    const frame = toDataFrame({
      meta: { type: DataFrameType.HeatmapRows },
      fields: [
        { name: 'time', type: FieldType.time, values: [1] },
        { name: 'b1', type: FieldType.number, values: [1], labels: { le: '1' } },
        { name: 'b2', type: FieldType.number, values: [2], labels: { le: '4' } },
        { name: 'b3', type: FieldType.number, values: [3], labels: { le: '+Inf' } },
      ],
    });
    const result = frameToBinnedHeatmap([frame], undefined, { rowsScale: { type: 'log', log: 2 } });
    expect(result!.yScale).toEqual({ type: 'log', log: 2 });
    // The first bucket starts one ratio (4) below its bound; +Inf reuses the previous ratio (4).
    expect(result!.yBuckets.map(({ start, end }) => [start, end])).toEqual([
      [0.25, 1],
      [1, 4],
      [4, 16],
    ]);
  });

  it('falls back to ordinal rows on a log scale when a bucket bound is 0', () => {
    const frame = toDataFrame({
      meta: { type: DataFrameType.HeatmapRows },
      fields: [
        { name: 'time', type: FieldType.time, values: [1] },
        { name: 'b0', type: FieldType.number, values: [1], labels: { le: '0' } },
        { name: 'b1', type: FieldType.number, values: [2], labels: { le: '1' } },
      ],
    });
    const result = frameToBinnedHeatmap([frame], undefined, { rowsScale: { type: 'log', log: 2 } });
    expect(result!.yScale).toBeUndefined();
    expect(result!.yBuckets.map(({ start, end }) => [start, end])).toEqual([
      [0, 1],
      [1, 2],
    ]);
  });

  it('leaves out filtered cells but keeps their buckets on the axis', () => {
    const result = frameToBinnedHeatmap([rowsFrame()], undefined, { filter: { le: 6 } });
    expect(result!.cells.map((cell) => cell.value)).toEqual([7, 8, 9, 10]);
    expect(result!.valueMin).toBe(7);
    expect(result!.yBuckets).toHaveLength(3);
  });

  it('uses the first field as the X axis even when it is numeric (no time field)', () => {
    const frame = toDataFrame({
      meta: { type: DataFrameType.HeatmapRows },
      fields: [
        { name: 'x', type: FieldType.number, values: [1, 2] },
        { name: 'b1', type: FieldType.number, values: [5, 6], labels: { le: '10' } },
        { name: 'b2', type: FieldType.number, values: [7, 8], labels: { le: '20' } },
      ],
    });

    const result = frameToBinnedHeatmap([frame], undefined, linear);
    expect(result).not.toBeNull();
    // 2 buckets x 2 X values; the numeric X field is not treated as a bucket row.
    expect(result!.cells).toHaveLength(4);
    expect(findCell(result!.cells, 1, 0)).toMatchObject({ xStart: 1, xEnd: 2, yStart: 0, yEnd: 10, value: 5 });
    expect(findCell(result!.cells, 2, 10)).toMatchObject({ xStart: 2, xEnd: 3, yStart: 10, yEnd: 20, value: 8 });
    // A numeric X field drives a value axis, not a time axis.
    expect(result!.xIsTime).toBe(false);
  });

  it('falls back to unit-height index buckets when no le labels exist', () => {
    const frame = toDataFrame({
      meta: { type: DataFrameType.HeatmapRows },
      fields: [
        { name: 'time', type: FieldType.time, values: [1] },
        { name: 'a', type: FieldType.number, values: [3] },
        { name: 'b', type: FieldType.number, values: [4] },
      ],
    });

    const result = frameToBinnedHeatmap([frame]);
    expect(findCell(result!.cells, 1, 0)).toMatchObject({ yStart: 0, yEnd: 1, value: 3 });
    expect(findCell(result!.cells, 1, 1)).toMatchObject({ yStart: 1, yEnd: 2, value: 4 });
    // No le labels: rows are ordinal, labelled by field name at their center.
    expect(result!.yLabelPlacement).toBe('center');
    expect(result!.yBuckets).toEqual([
      { start: 0, end: 1, label: 'a' },
      { start: 1, end: 2, label: 'b' },
    ]);
  });
});

describe('frameToBinnedHeatmap - heatmap-cells', () => {
  it('uses explicit min/max bounds (sparse) and the first non-axis value field', () => {
    const frame = toDataFrame({
      meta: { type: DataFrameType.HeatmapCells },
      fields: [
        { name: 'xMin', type: FieldType.time, values: [1000, 2000] },
        { name: 'xMax', type: FieldType.time, values: [2000, 3000] },
        { name: 'yMin', type: FieldType.number, values: [0, 10] },
        { name: 'yMax', type: FieldType.number, values: [10, 20] },
        { name: 'Count', type: FieldType.number, values: [3, 7] },
      ],
    });

    const result = frameToBinnedHeatmap([frame]);
    expect(result!.cells).toHaveLength(2);
    expect(result!.cells[0]).toMatchObject({ xStart: 1000, xEnd: 2000, yStart: 0, yEnd: 10, value: 3 });
    expect(result!.cells[1]).toMatchObject({ xStart: 2000, xEnd: 3000, yStart: 10, yEnd: 20, value: 7 });
    // xMin/xMax are time fields, so the axis is time-based.
    expect(result!.xIsTime).toBe(true);
    // Cell bounds give bound-placed bucket labels (the upper edge per row).
    expect(result!.yLabelPlacement).toBe('bound');
    expect(result!.yBuckets).toEqual([
      { start: 0, end: 10, label: '10' },
      { start: 10, end: 20, label: '20' },
    ]);
  });

  it('infers cell size from center x/y values when only centers are present', () => {
    const frame = toDataFrame({
      meta: { type: DataFrameType.HeatmapCells },
      fields: [
        { name: 'x', type: FieldType.number, values: [10, 20] },
        { name: 'y', type: FieldType.number, values: [1, 2] },
        { name: 'Count', type: FieldType.number, values: [5, 8] },
      ],
    });

    const result = frameToBinnedHeatmap([frame]);
    // x step = 10 -> +/- 5; y step = 1 -> +/- 0.5
    expect(result!.cells[0]).toMatchObject({ xStart: 5, xEnd: 15, yStart: 0.5, yEnd: 1.5, value: 5 });
    // The center `x` field is numeric, so the axis is a value axis.
    expect(result!.xIsTime).toBe(false);
  });
});

describe('frameToBinnedHeatmap - dense heatmap-cells (core calculation output)', () => {
  // Two x columns by three y buckets, as core's "Calculate from data" emits them.
  const dense = (yConfig = {}) =>
    toDataFrame({
      meta: { type: DataFrameType.HeatmapCells },
      fields: [
        { name: 'xMin', type: FieldType.time, values: [1000, 1000, 1000, 2000, 2000, 2000] },
        { name: 'yMin', type: FieldType.number, values: [1, 2, 4, 1, 2, 4], config: yConfig },
        { name: 'Count', type: FieldType.number, values: [0, 3, 1, 2, 0, 5] },
      ],
    });

  it('spans each cell from its lower bound to the next bucket and x step', () => {
    const result = frameToBinnedHeatmap([dense()]);
    expect(result!.cells[0]).toMatchObject({ xStart: 1000, xEnd: 2000, yStart: 1, yEnd: 2 });
    // The top bucket repeats the last linear step (2).
    expect(result!.yBuckets.map(({ start, end }) => [start, end])).toEqual([
      [1, 2],
      [2, 4],
      [4, 6],
    ]);
    expect(result!.yScale).toEqual({ type: 'linear' });
  });

  it('reads a log scale from the yMin field config and extends the top bucket by ratio', () => {
    const result = frameToBinnedHeatmap([dense({ custom: { scaleDistribution: { type: 'log', log: 2 } } })]);
    expect(result!.yScale).toEqual({ type: 'log', log: 2 });
    expect(result!.yBuckets.at(-1)).toMatchObject({ start: 4, end: 8 });
  });

  it("hides empty cells with core's default filter (le 1e-9)", () => {
    const result = frameToBinnedHeatmap([dense()], undefined, { filter: { le: 1e-9 } });
    expect(result!.cells.map((cell) => cell.value)).toEqual([3, 1, 2, 5]);
    // The Y range still covers every bucket.
    expect([result!.yMin, result!.yMax]).toEqual([1, 6]);
  });
});

describe('frameToBinnedHeatmap - Prometheus native histogram (sparse heatmap-cells)', () => {
  it('ends each cell at xMax and spans the explicit y bounds', () => {
    // The shape Grafana's Prometheus datasource emits for native histograms.
    const frame = toDataFrame({
      meta: { type: DataFrameType.HeatmapCells },
      fields: [
        { name: 'xMax', type: FieldType.time, values: [2000, 2000, 3000] },
        { name: 'yMin', type: FieldType.number, values: [0.5, 1, 0.5] },
        { name: 'yMax', type: FieldType.number, values: [1, 2, 1] },
        { name: 'count', type: FieldType.number, values: [4, 1, 2] },
        { name: 'yLayout', type: FieldType.number, values: [0, 0, 0] },
      ],
    });
    const result = frameToBinnedHeatmap([frame]);
    expect(result!.cells[0]).toMatchObject({ xStart: 1000, xEnd: 2000, yStart: 0.5, yEnd: 1, value: 4 });
    expect(result!.cells[2]).toMatchObject({ xStart: 2000, xEnd: 3000 });
    // Both y bounds are explicit, so the axis keeps one label per bucket bound.
    expect(result!.yScale).toBeUndefined();
  });
});

describe('frameToBinnedHeatmap - no usable data', () => {
  it('returns null when no cells can be derived', () => {
    const frame = toDataFrame({
      meta: { type: DataFrameType.HeatmapRows },
      fields: [{ name: 'time', type: FieldType.time, values: [1] }],
    });
    expect(frameToBinnedHeatmap([frame])).toBeNull();
  });
});
