import { type DataFrame, type Field, FieldType, getFieldDisplayName } from '@grafana/data';
import { heatmapFrameTypes } from 'editor/constants';
import { type EChartsFieldConfig } from 'editor/types';
import { formatBucketBound } from 'lib/echarts/format';
import { type FieldTypedDataFrame, type NumericFrame } from 'lib/grafana/types';

/**
 * A single binned heatmap cell with explicit bounds in data space.
 *
 * Bounds are half-open rectangles `[xStart, xEnd) x [yStart, yEnd)` in the
 * axis' native units (time in ms for X, bucket value for Y). Drawing from
 * explicit bounds lets the cell layer render on a continuous `time` x-axis via
 * a custom series, which the native ECharts heatmap can't do in this version
 * (it requires two category axes).
 */
export interface BinnedHeatmapCell {
  xStart: number;
  xEnd: number;
  yStart: number;
  yEnd: number;
  value: number | null;
  /**
   * The numeric field this cell's value was read from, and its row within that
   * field. Both layouts build one cell per (field, row) pair, so the tooltip
   * footer can resolve the hovered cell's data links (see `EChartsTooltip`).
   */
  field: Field<number>;
  rowIndex: number;
}

/**
 * A Y-axis bucket (heatmap row), with its bounds in data space and the label to
 * show for it. For Prometheus-style histograms the label is the `le` upper
 * bound; for plain wide series reused as rows it is the field display name.
 */
export interface BinnedHeatmapBucket {
  start: number;
  end: number;
  label: string;
}

/**
 * The chart-agnostic binned heatmap model: the cells plus the value and Y
 * (bucket) ranges needed to configure the visualMap and the bucket axis.
 */
export interface BinnedHeatmapData {
  cells: BinnedHeatmapCell[];
  /** Min/max of finite cell values, for the visualMap color range. */
  valueMin: number;
  valueMax: number;
  /** Min/max of the bucket (Y) bounds, for the heatmap value axis. */
  yMin: number;
  yMax: number;
  /**
   * Whether the X axis is time-based. The dataplane heatmap X field may be time
   * or numeric, so the caller uses this to pick a `time` vs `value` x-axis. True
   * only when every contributing frame's X field is a time field.
   */
  xIsTime: boolean;
  /** The distinct Y buckets (rows), ordered by their lower bound. */
  yBuckets: BinnedHeatmapBucket[];
  /**
   * How to draw the Y axis. `buckets` pins one label per bucket bound (source
   * buckets). `linear` and `log` use a plain numeric scale with auto ticks,
   * which suits the many uniform buckets of a calculated heatmap. Unset means
   * `buckets`.
   */
  yScale?: BinnedHeatmapYScale;
  /**
   * How to place the Y bucket labels. `bound` labels each bucket at its upper
   * edge (Prometheus `le` histograms / numeric cell bounds); `center` labels
   * each bucket at its midpoint (ordinal rows labelled by field name).
   */
  yLabelPlacement: 'bound' | 'center';
  /**
   * The value field of the first contributing frame, so the caller can build a
   * display processor (unit, decimals) for the cell values from real field
   * config rather than a synthetic field.
   */
  valueField: Field<number>;
}

/** Y axis scale of the cell layer. `log` carries its base. */
export type BinnedHeatmapYScale = { type: 'buckets' } | { type: 'linear' } | { type: 'log'; log: number };

/**
 * Cells to leave out, like core Grafana's "Hide cells with values" options: a
 * cell is drawn only when `le < value < ge`. Null values are never drawn when
 * a filter is set.
 */
export interface BinnedHeatmapCellFilter {
  le?: number;
  ge?: number;
}

/**
 * How to place `le` buckets on the Y axis, like core Grafana's "Y bucket
 * scale" for heatmap-rows. `auto` (the default) gives every bucket the same
 * height, which keeps exponential Prometheus buckets readable. `linear` and
 * `log` place buckets at their numeric bounds.
 */
export type BinnedHeatmapRowsScale = { type: 'auto' } | { type: 'linear' } | { type: 'log'; log: number };

export interface BinnedHeatmapOptions {
  filter?: BinnedHeatmapCellFilter;
  rowsScale?: BinnedHeatmapRowsScale;
}

/** Cells plus the bucket metadata derived from a single heatmap frame. */
interface FrameHeatmap {
  cells: BinnedHeatmapCell[];
  buckets: BinnedHeatmapBucket[];
  /** Numeric Y scale of a dense heatmap-cells frame. Unset for source buckets. */
  yScale?: BinnedHeatmapYScale;
  /** True for numeric/`le` bounds, false for ordinal (field-name) rows. */
  labelsAtBounds: boolean;
  /** The frame's value field, used to derive the cell value display (unit, decimals). */
  valueField?: Field<number>;
}

const EMPTY_FRAME_HEATMAP: FrameHeatmap = { cells: [], buckets: [], labelsAtBounds: true };

export { formatBucketBound } from 'lib/echarts/format';

/**
 * Whether a frame is a Grafana heatmap frame (heatmap-rows or heatmap-cells),
 * identified by its dataplane frame type. See
 * https://grafana.com/developers/dataplane/heatmap
 */
export function isBinnedHeatmapFrame(frame: DataFrame): boolean {
  const type = frame.meta?.type;
  return type != null && heatmapFrameTypes.includes(type);
}

/** Smallest positive gap between consecutive sorted values, for cell sizing. */
function minPositiveStep(values: number[]): number {
  const sorted = Array.from(new Set(values.filter((value) => Number.isFinite(value)))).sort((a, b) => a - b);
  let step = Infinity;
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i] - sorted[i - 1];
    if (gap > 0 && gap < step) {
      step = gap;
    }
  }
  return Number.isFinite(step) ? step : 1;
}

function fieldByName<T>(frame: FieldTypedDataFrame<T, EChartsFieldConfig>, name: string): Field<T> | undefined {
  return frame.fields.find((field) => field.name === name);
}

/**
 * Whether the frame's X axis is time-based. Mirrors the X-field resolution used
 * by the cell builders: positional first field for heatmap-rows, and the
 * `xMin`/`xMax`/`x` (or first time field) for heatmap-cells.
 */
function frameXIsTime(frame: DataFrame): boolean {
  if (frame.meta?.type === 'heatmap-cells') {
    const xField =
      fieldByName(frame, 'xMin') ??
      fieldByName(frame, 'xMax') ??
      fieldByName(frame, 'x') ??
      frame.fields.find((field) => field.type === FieldType.time);
    return xField?.type === FieldType.time;
  }
  return frame.fields[0]?.type === FieldType.time;
}

/**
 * Heatmap-rows: the first field is the X axis and every *remaining* numeric
 * field is a bucket row. Per the dataplane spec the X field is not required to
 * be time — it may be numeric — so the X axis is taken positionally (the first
 * field) rather than by type, matching core Grafana (`heatmap.fields[0]`). See
 * https://grafana.com/developers/dataplane/heatmap
 *
 * The bucket's upper bound comes from its `le` label (Prometheus histogram
 * convention); the lower bound is the previous row's upper bound. When no `le`
 * labels exist (e.g. a plain wide time series reused as heatmap-rows), rows fall
 * back to unit-height buckets indexed by field order.
 *
 * X cells span `[x, x + step)` where `step` is the smallest gap between X values
 * (the last column reuses the prior step).
 */
function rowsToCells(
  frame: FieldTypedDataFrame<number, EChartsFieldConfig>,
  series: DataFrame[],
  keep: (value: number | null) => boolean,
  rowsScale: BinnedHeatmapRowsScale = { type: 'auto' }
): FrameHeatmap {
  const xField = frame.fields[0];
  if (!xField || (xField.type !== FieldType.time && xField.type !== FieldType.number)) {
    return EMPTY_FRAME_HEATMAP;
  }

  // Every numeric field after the X field is a bucket row. The X field is taken
  // positionally, so a numeric X field is never also treated as a row.
  const numericFields = frame.fields.filter((field, index) => index > 0 && field.type === FieldType.number);
  if (numericFields.length === 0) {
    return EMPTY_FRAME_HEATMAP;
  }

  const xs = xField.values;
  const xStep = minPositiveStep(xs);

  // Order rows by their numeric `le` upper bound when present so stacked bucket
  // bounds are contiguous; otherwise keep field order.
  const hasLe = numericFields.some((field) => field.labels?.le != null);
  const parseLe = (field: Field, fallback: number): number => {
    const le = field.labels?.le;
    if (le == null) {
      return fallback;
    }
    const num = le === '+Inf' ? Infinity : Number(le);
    return Number.isNaN(num) ? fallback : num;
  };

  const rows = numericFields.map((field, index) => ({
    field,
    name: getFieldDisplayName(field, frame, series),
    le: field.labels?.le,
    upper: hasLe ? parseLe(field, index + 1) : index + 1,
  }));
  rows.sort((a, b) => a.upper - b.upper);

  // `le` buckets on the `auto` scale are ordinal: bucket r spans [r, r + 1),
  // labelled with its `le` bound. See `BinnedHeatmapRowsScale`.
  // A log scale cannot show a `le="0"` (or negative) bound, so such a frame
  // falls back to ordinal rows.
  const logFits = rows.every((row) => !Number.isFinite(row.upper) || row.upper > 0);
  const logBase = hasLe && rowsScale.type === 'log' && logFits ? rowsScale.log : undefined;
  const ordinal = hasLe && (rowsScale.type === 'auto' || (rowsScale.type === 'log' && !logBase));

  const cells: BinnedHeatmapCell[] = [];
  const buckets: BinnedHeatmapBucket[] = [];
  for (let r = 0; r < rows.length; r++) {
    const { field, upper } = rows[r];
    let yStart: number;
    let yEnd: number;
    if (ordinal) {
      yStart = r;
      yEnd = r + 1;
    } else if (logBase) {
      // A log scale has no 0: the first bucket starts one ratio below its
      // bound, and an open (+Inf) top bucket ends one ratio above its start.
      const next = rows[r + 1]?.upper;
      const ratio = r > 0 ? upper / rows[r - 1].upper : Number.isFinite(next) && next > upper ? next / upper : logBase;
      yStart = r === 0 ? upper / ratio : rows[r - 1].upper;
      const prevRatio = r > 1 ? rows[r - 1].upper / rows[r - 2].upper : logBase;
      yEnd = Number.isFinite(upper) ? upper : yStart * prevRatio;
    } else {
      yStart = r === 0 ? 0 : rows[r - 1].upper;
      // An open-ended (+Inf) top bucket reuses the previous bucket's height so it
      // stays visible rather than spanning to infinity.
      const prevHeight = r === 0 ? 1 : rows[r - 1].upper - (r === 1 ? 0 : rows[r - 2].upper);
      yEnd = Number.isFinite(upper) ? upper : yStart + prevHeight;
    }

    // With `le` labels the bucket label is the upper bound (the original `le`
    // string preserves "+Inf"); otherwise it is the field display name.
    buckets.push({ start: yStart, end: yEnd, label: hasLe ? (rows[r].le ?? formatBucketBound(upper)) : rows[r].name });

    for (let i = 0; i < xs.length; i++) {
      const raw = field.values[i];
      const value = typeof raw === 'number' ? raw : null;
      if (!keep(value)) {
        continue;
      }
      cells.push({ xStart: xs[i], xEnd: xs[i] + xStep, yStart, yEnd, value, field, rowIndex: i });
    }
  }

  // Numeric `le` rows on a log scale get a log axis; other rows keep one label per bound.
  const yScale: BinnedHeatmapYScale | undefined = logBase ? { type: 'log', log: logBase } : undefined;
  return { cells, buckets, labelsAtBounds: hasLe, valueField: rows[0]?.field, yScale };
}

/**
 * The log base of a Y field, read from the `scaleDistribution` that core
 * Grafana's heatmap calculation writes to the `yMin` field config.
 * See https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/heatmap/#y-bucket-scale
 */
function fieldLogBase(field: Field | undefined): number | undefined {
  const custom: unknown = field?.config.custom;
  const distribution: unknown =
    typeof custom === 'object' && custom !== null && 'scaleDistribution' in custom
      ? custom.scaleDistribution
      : undefined;
  if (typeof distribution !== 'object' || distribution === null || !('type' in distribution)) {
    return undefined;
  }
  if (distribution.type !== 'log') {
    return undefined;
  }
  return 'log' in distribution && typeof distribution.log === 'number' ? distribution.log : 2;
}

/**
 * Bounds for the buckets of a dense frame, which has only one Y bound per cell
 * (`yMin` or `yMax`). The missing bound is the adjacent bucket's bound. The
 * outermost bucket reuses the last step: a ratio on a log scale, a difference
 * on a linear scale. This matches core Grafana, which sizes dense cells from
 * the bucket increment.
 */
function denseBucketBounds(values: number[], edge: 'min' | 'max', logBase?: number): Map<number, [number, number]> {
  const sorted = Array.from(new Set(values.filter((value) => Number.isFinite(value)))).sort((a, b) => a - b);
  const bounds = new Map<number, [number, number]>();
  if (sorted.length === 0) {
    return bounds;
  }
  const n = sorted.length;
  const step = (a: number, b: number) => (logBase ? b / a : b - a);
  const apply = (value: number, by: number, dir: 1 | -1) => (logBase ? value * by ** dir : value + by * dir);

  if (edge === 'min') {
    const lastStep = n > 1 ? step(sorted[n - 2], sorted[n - 1]) : (logBase ?? 1);
    sorted.forEach((value, i) => bounds.set(value, [value, i < n - 1 ? sorted[i + 1] : apply(value, lastStep, 1)]));
  } else {
    const firstStep = n > 1 ? step(sorted[0], sorted[1]) : (logBase ?? 1);
    sorted.forEach((value, i) => bounds.set(value, [i > 0 ? sorted[i - 1] : apply(value, firstStep, -1), value]));
  }
  return bounds;
}

/**
 * Heatmap-cells: one row per cell.
 *
 * - Sparse frames have both bounds per axis (`xMin`/`xMax`, `yMin`/`yMax`).
 * - Dense frames have one bound per axis. `xMin`/`yMin` is the lower edge and
 *   `xMax`/`yMax` the upper edge (core's `ge`/`le` layouts); the other edge is
 *   inferred from the bucket size. A center `x`/`y` spans +/- half a step.
 *
 * A dense `yMin`/`yMax` frame (for example the output of core's heatmap
 * calculation) gets a numeric Y scale, log when the field config says so.
 * The first value field that isn't an axis-bound field is the displayed value.
 * See https://grafana.com/developers/dataplane/heatmap#heatmap-cells
 */
function cellsToCells(frame: NumericFrame, keep: (value: number | null) => boolean): FrameHeatmap {
  const xMin = fieldByName(frame, 'xMin');
  const xMax = fieldByName(frame, 'xMax');
  const xCenter =
    fieldByName(frame, 'x') ?? (xMin || xMax ? undefined : frame.fields.find((field) => field.type === FieldType.time));

  const yMin = fieldByName(frame, 'yMin');
  const yMax = fieldByName(frame, 'yMax');
  const yCenter = fieldByName(frame, 'y');

  const axisNames = new Set(['x', 'xMin', 'xMax', 'y', 'yMin', 'yMax']);
  const valueField = frame.fields.find(
    (field) => field.type === FieldType.number && !axisNames.has(field.name) && field !== xCenter && field !== yCenter
  );

  if (!valueField) {
    return EMPTY_FRAME_HEATMAP;
  }

  const rowCount = frame.length;
  const xEdge = xMin ?? xMax;
  const xStep = xCenter ? minPositiveStep(xCenter.values) : xEdge ? minPositiveStep(xEdge.values) : 1;
  const yStep = yCenter ? minPositiveStep(yCenter.values) : 1;

  // Dense Y: exactly one of yMin / yMax.
  const yEdgeField = yMin && !yMax ? yMin : yMax && !yMin ? yMax : undefined;
  const yLog = fieldLogBase(yEdgeField);
  const denseY = yEdgeField
    ? denseBucketBounds(yEdgeField.values, yEdgeField === yMin ? 'min' : 'max', yLog)
    : undefined;

  const cells: BinnedHeatmapCell[] = [];
  // Distinct Y bucket bounds (cells repeat the same row across X), keyed to
  // dedupe so the bucket axis gets one label per row.
  const bucketByKey = new Map<string, BinnedHeatmapBucket>();
  for (let i = 0; i < rowCount; i++) {
    let xs: number;
    let xe: number;
    if (xMin && xMax) {
      xs = Number(xMin.values[i]);
      xe = Number(xMax.values[i]);
    } else if (xMin) {
      xs = Number(xMin.values[i]);
      xe = xs + xStep;
    } else if (xMax) {
      xe = Number(xMax.values[i]);
      xs = xe - xStep;
    } else if (xCenter) {
      xs = Number(xCenter.values[i]) - xStep / 2;
      xe = Number(xCenter.values[i]) + xStep / 2;
    } else {
      xs = i;
      xe = i + 1;
    }

    let ys: number;
    let ye: number;
    if (denseY && yEdgeField) {
      [ys, ye] = denseY.get(Number(yEdgeField.values[i])) ?? [NaN, NaN];
    } else {
      ys = yMin ? Number(yMin.values[i]) : yCenter ? Number(yCenter.values[i]) - yStep / 2 : i;
      ye = yMax ? Number(yMax.values[i]) : yCenter ? Number(yCenter.values[i]) + yStep / 2 : i + 1;
    }
    const raw = valueField.values[i];
    const value = typeof raw === 'number' ? raw : null;

    const key = `${ys}:${ye}`;
    if (!bucketByKey.has(key)) {
      bucketByKey.set(key, { start: ys, end: ye, label: formatBucketBound(ye) });
    }

    if (!keep(value)) {
      continue;
    }
    cells.push({ xStart: xs, xEnd: xe, yStart: ys, yEnd: ye, value, field: valueField, rowIndex: i });
  }

  const yScale: BinnedHeatmapYScale | undefined = denseY
    ? yLog
      ? { type: 'log', log: yLog }
      : { type: 'linear' }
    : undefined;

  return { cells, buckets: Array.from(bucketByKey.values()), labelsAtBounds: true, valueField, yScale };
}

/** Build the keep-predicate for a cell filter. No filter keeps every cell. */
function cellFilterPredicate(filter?: BinnedHeatmapCellFilter): (value: number | null) => boolean {
  if (filter?.le == null && filter?.ge == null) {
    return () => true;
  }
  const { le = -Infinity, ge = Infinity } = filter;
  return (value) => value != null && value > le && value < ge;
}

/**
 * Convert Grafana heatmap frames (heatmap-rows and/or heatmap-cells) into the
 * common binned cell model plus the value and bucket ranges. Multiple heatmap
 * frames are merged into a single cell set.
 *
 * `filter` leaves out cells by value; the value range comes from the kept
 * cells only. `rowsScale` places `le` buckets (see `BinnedHeatmapRowsScale`).
 *
 * Returns `null` when no usable cells can be derived, so the caller can skip the
 * heatmap layer.
 */
export function frameToBinnedHeatmap(
  frames: DataFrame[],
  series: DataFrame[] = frames,
  { filter, rowsScale }: BinnedHeatmapOptions = {}
): BinnedHeatmapData | null {
  const keep = cellFilterPredicate(filter);
  const cells: BinnedHeatmapCell[] = [];
  const bucketByKey = new Map<string, BinnedHeatmapBucket>();
  // X axis is time only when every frame that actually contributes cells uses a
  // time X field; a single numeric-X frame drops the whole layer to a value axis.
  let xIsTime = true;
  // Bucket labels sit at their bounds unless every contributing frame is ordinal
  // (plain rows labelled by field name), in which case they sit at the center.
  let labelsAtBounds = true;
  // The value field of the first frame that contributes cells
  let valueField: Field<number> | undefined;
  // Numeric Y scale of the first dense frame; source buckets otherwise.
  let yScale: BinnedHeatmapYScale | undefined;

  for (const frame of frames) {
    const frameHeatmap =
      frame.meta?.type === 'heatmap-cells'
        ? cellsToCells(frame, keep)
        : // heatmap-rows (and timeseries-wide reused as rows).
          rowsToCells(frame, series, keep, rowsScale);

    if (frameHeatmap.cells.length === 0) {
      continue;
    }

    yScale ??= frameHeatmap.yScale;
    cells.push(...frameHeatmap.cells);
    valueField ??= frameHeatmap.valueField;
    xIsTime = xIsTime && frameXIsTime(frame);
    labelsAtBounds = labelsAtBounds && frameHeatmap.labelsAtBounds;
    for (const bucket of frameHeatmap.buckets) {
      const key = `${bucket.start}:${bucket.end}`;
      if (!bucketByKey.has(key)) {
        bucketByKey.set(key, bucket);
      }
    }
  }

  if (cells.length === 0 || !valueField) {
    return null;
  }

  const yBuckets = Array.from(bucketByKey.values()).sort((a, b) => a.start - b.start);

  let valueMin = Infinity;
  let valueMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;

  for (const cell of cells) {
    if (cell.value != null && Number.isFinite(cell.value)) {
      valueMin = Math.min(valueMin, cell.value);
      valueMax = Math.max(valueMax, cell.value);
    }
  }
  // The Y range spans every bucket, including buckets whose cells the filter
  // left out, so hiding empty cells does not crop the axis.
  for (const bucket of yBuckets) {
    if (Number.isFinite(bucket.start)) {
      yMin = Math.min(yMin, bucket.start);
    }
    if (Number.isFinite(bucket.end)) {
      yMax = Math.max(yMax, bucket.end);
    }
  }

  if (!Number.isFinite(valueMin)) {
    valueMin = 0;
    valueMax = 0;
  }
  if (!Number.isFinite(yMin)) {
    yMin = 0;
    yMax = 1;
  }

  return {
    cells,
    valueMin,
    valueMax,
    yMin,
    yMax,
    xIsTime,
    yBuckets,
    yLabelPlacement: labelsAtBounds ? 'bound' : 'center',
    yScale,
    valueField,
  };
}
