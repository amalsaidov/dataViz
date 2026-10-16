import { type Field } from '@grafana/data';
import { resolveFieldSpanNulls } from 'lib/echarts/converters/fieldOverrides';
import { isSpanNullsThreshold, spannedRows } from 'lib/echarts/converters/spanNulls';
import { isFieldHiddenFromViz } from 'lib/grafana/fields/fieldConfig';

/** The frame rows that a series draws, with the field value and the drawn value at each of them. */
export interface DrawnSeries {
  rows: number[];
  /** The field value at each row. The tooltip shows it. */
  values: Array<number | null>;
  /** The value that the series draws at each row, if it is not the field value. */
  drawnValues?: Array<number | null>;
  /**
   * The points where the line connects over a row that the stack keeps, as indexes of `rows`. The
   * drawn value there is null until `connectStackedLines` puts the point on the segment of the line.
   */
  connected?: number[];
}

/**
 * The drawn rows and values of one stack of line series (a line with a fill is an area). The fields
 * share one time field: ECharts stacks by data index on a time axis, so the stacked fields of several
 * frames are joined first (see `joinStackedFieldsOnTime`).
 * https://echarts.apache.org/en/option.html#series-line.stack
 *
 * The null rules of core Time series (`preparePlotData2`):
 * https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/uPlot/utils.ts
 *
 * - A null at a row where another field of the stack has a value adds 0. The line of the field then
 *   draws on the line below it, and it does not break.
 * - At a row where each field of the stack has no value, "Connect null values" decides
 *   (`spanNulls.ts`), and a line always connects over a row that the time join adds. The stack
 *   leaves out the row when each field connects over it, so that each line draws one segment
 *   across it. Otherwise the row stays: a field that breaks draws null, and a field that connects
 *   gets a `connected` point (see `connectStackedLines`).
 * - A field hidden from the viz (`hideFrom.viz`) does not give a row a value, as core `anyValsAtX`.
 *
 * All the series of a stack draw the same rows, because ECharts stacks by data index. The field
 * values do not change.
 */
export function stackedLineSeries(xs: ArrayLike<unknown>, fields: Field[]): DrawnSeries[] {
  const length = xs.length;
  const visible = fields.filter((field) => !isFieldHiddenFromViz(field));
  const hasValue = Array.from({ length }, (_, row) => visible.some((field) => field.values[row] != null));
  const connects = fields.map((field) => connectsAt(xs, field));

  const rows: number[] = [];
  for (let row = 0; row < length; row++) {
    if (hasValue[row] || !connects.every((connect) => connect(row))) {
      rows.push(row);
    }
  }
  return fields.map((field, i) => {
    const values: ArrayLike<number | null | undefined> = field.values;
    const connected = rows.flatMap((row, index) =>
      values[row] == null && !hasValue[row] && connects[i](row) ? [index] : []
    );
    return {
      rows,
      values: rows.map((row) => values[row] ?? null),
      drawnValues: rows.map((row) => values[row] ?? (hasValue[row] ? 0 : null)),
      ...(connected.length > 0 ? { connected } : {}),
    };
  });
}

/**
 * Put each `connected` point of a stack of lines on the segment of its line, so that the line
 * connects over the row as in core. The segment goes from the stacked value of the point before
 * to the stacked value of the point after, in x. The drawn value is that position less the
 * stacked values below it. `drawn` is in stack order, after the percent and "Negative Y" steps,
 * because ECharts stacks these values. ECharts adds only the values of the same sign (the default
 * `stackStrategy: 'samesign'`).
 * https://echarts.apache.org/en/option.html#series-line.stackStrategy
 */
export function connectStackedLines(
  xs: ArrayLike<unknown>,
  drawn: Array<Array<number | null>>,
  connected: number[][]
): Array<Array<number | null>> {
  const result = drawn.map((values) => [...values]);
  const below = (k: number, index: number, sign: number) =>
    result
      .slice(0, k)
      .reduce((sum, values) => sum + (Math.sign(values[index] ?? 0) === sign ? (values[index] ?? 0) : 0), 0);
  const top = (k: number, index: number) => {
    const value = result[k][index] ?? 0;
    return value + below(k, index, value < 0 ? -1 : 1);
  };

  result.forEach((values, k) => {
    const points = new Set(connected[k]);
    for (const index of points) {
      const before = findPoint(values, points, index, -1);
      const after = findPoint(values, points, index, 1);
      if (before == null || after == null) {
        continue;
      }
      const [x0, x1, x] = [before, after, index].map((i) => Number(xs[i]));
      const [y0, y1] = [top(k, before), top(k, after)];
      const y = x1 === x0 ? y0 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
      values[index] = y - below(k, index, y < 0 ? -1 : 1);
    }
  });
  return result;
}

/** The nearest point of a line in one direction that has a drawn value and is not `connected`. */
function findPoint(values: Array<number | null>, connected: Set<number>, from: number, step: 1 | -1) {
  for (let i = from + step; i >= 0 && i < values.length; i += step) {
    if (values[i] != null && !connected.has(i)) {
      return i;
    }
  }
  return undefined;
}

/**
 * Whether the line of a field connects over its missing value at a row. The time join leaves
 * `undefined` where a frame has no row, and it follows "Connect null values" as core does: `true`
 * turns each null into `undefined` (`joinDataFrames`). As uPlot, the line connects over each
 * `undefined`.
 */
function connectsAt(xs: ArrayLike<unknown>, field: Field): (row: number) => boolean {
  const spanNulls = resolveFieldSpanNulls(field);
  const isUndefined = (row: number) => field.values[row] === undefined;
  if (isSpanNullsThreshold(spanNulls)) {
    // `spannedRows` keeps the nulls that break the line.
    const kept = new Set(spannedRows(xs, field.values, spanNulls));
    return (row) => isUndefined(row) || !kept.has(row);
  }
  return (row) => spanNulls || isUndefined(row);
}
