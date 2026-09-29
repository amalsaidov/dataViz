/**
 * "Connect null values" (core Time series `custom.spanNulls`) for the line series of the time axis.
 *
 * - `false`: a null breaks the line (ECharts `connectNulls: false`, the default).
 * - `true`: the line connects over each null (ECharts `connectNulls: true`).
 *   https://echarts.apache.org/en/option.html#series-line.connectNulls
 * - A number: the line connects over a run of nulls only when the two values around the run are
 *   less than this distance apart on the x axis (milliseconds on a time axis). As core
 *   `nullToUndefThreshold`, which the core panel applies in `applySpanNullsThresholds`:
 *   https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/transformations/transformers/nulls/nullToUndefThreshold.ts
 *   https://github.com/grafana/grafana/blob/main/public/app/core/components/GraphNG/utils.ts
 */
export type SpanNulls = boolean | number;

/**
 * The rows that a line series draws, for a numeric `spanNulls` threshold. The series leaves out the
 * null rows of each run that it connects over, so ECharts draws one segment across the run. The
 * other nulls stay and break the line. Leading and trailing nulls stay, because they have no value
 * on one side. The field values do not change.
 */
export function spannedRows(xs: ArrayLike<unknown>, values: ArrayLike<unknown>, threshold: number): number[] {
  const rows: number[] = [];
  // The first null row of the current run, after a value.
  let runStart: number | undefined;
  // The x of the last value.
  let prevX: number | undefined;

  for (let row = 0; row < values.length; row++) {
    if (values[row] == null) {
      if (runStart == null && prevX != null) {
        runStart = row;
      }
      if (prevX == null) {
        rows.push(row);
      }
      continue;
    }
    if (runStart != null && prevX != null && !(Number(xs[row]) - prevX < threshold)) {
      // The gap is too long: keep the nulls, so they break the line.
      for (let kept = runStart; kept < row; kept++) {
        rows.push(kept);
      }
    }
    runStart = undefined;
    rows.push(row);
    prevX = Number(xs[row]);
  }

  // Trailing nulls have no value after them: keep them.
  if (runStart != null) {
    for (let kept = runStart; kept < values.length; kept++) {
      rows.push(kept);
    }
  }
  return rows;
}

/** Whether a numeric `spanNulls` changes which rows a series draws. */
export function isSpanNullsThreshold(spanNulls: SpanNulls | undefined): spanNulls is number {
  return typeof spanNulls === 'number';
}
