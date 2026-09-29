import { type Field } from '@grafana/data';
import { resolveFieldSpanNulls } from 'lib/echarts/converters/fieldOverrides';
import { isSpanNullsThreshold, spannedRows } from 'lib/echarts/converters/spanNulls';

/** The frame rows that a series draws, with the field value and the drawn value at each of them. */
export interface DrawnSeries {
  rows: number[];
  /** The field value at each row. The tooltip shows it. */
  values: Array<number | null>;
  /** The value that the series draws at each row, if it is not the field value. */
  drawnValues?: Array<number | null>;
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
 *   across it. Otherwise the row stays, and a field that connects over each null
 *   (`spanNulls: true`) does so with ECharts `connectNulls`. A field with a numeric threshold then
 *   breaks at the row, where core connects it (#440).
 *
 * All the series of a stack draw the same rows, because ECharts stacks by data index. The field
 * values do not change.
 */
export function stackedLineSeries(xs: ArrayLike<unknown>, fields: Field[]): DrawnSeries[] {
  const length = xs.length;
  const hasValue = Array.from({ length }, (_, row) => fields.some((field) => field.values[row] != null));
  const connects = fields.map((field) => connectsAt(xs, field));

  const rows: number[] = [];
  for (let row = 0; row < length; row++) {
    if (hasValue[row] || !connects.every((connect) => connect(row))) {
      rows.push(row);
    }
  }
  return fields.map((field) => {
    const values: ArrayLike<number | null | undefined> = field.values;
    return {
      rows,
      values: rows.map((row) => values[row] ?? null),
      drawnValues: rows.map((row) => values[row] ?? (hasValue[row] ? 0 : null)),
    };
  });
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
