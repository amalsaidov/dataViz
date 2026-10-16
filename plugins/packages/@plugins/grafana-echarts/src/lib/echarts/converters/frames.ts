import {
  type DataFrame,
  type Field,
  getFieldDisplayName,
  type GrafanaTheme2,
  outerJoinDataFrames,
} from '@grafana/data';
import { type EChartsFieldConfig } from 'editor/types';
import { getSeriesColor } from 'lib/echarts/style';
import { isNumberField, isStringField, isTimeField } from 'lib/grafana/narrowing';
import { type FieldTypedDataFrame } from 'lib/grafana/types';

/**
 * First frame with at least one numeric field — the categorical chart source frame.
 */
export function findCategoricalFrame<T>(
  series: Array<FieldTypedDataFrame<T | number, EChartsFieldConfig>>
): FieldTypedDataFrame<T | number, EChartsFieldConfig> | undefined {
  return series.find((frame) => frame.fields.some(isNumberField));
}

/**
 * Return first string field as category field
 */
export function findCategoryField(frame: DataFrame) {
  return frame.fields.find(isStringField);
}

/**
 * True when any frame carries a genuine time field.
 *
 * This is the data-driven signal that separates the two cartesian modes: time
 * frames render on a `time` x-axis, while Numeric frames without a
 * time field render on a `category` x-axis. It intentionally ignores
 * the numeric-field fallback used by `resolveTimeField`, which treats a numeric
 * column as an X axis for time series and would otherwise mask category data.
 *
 * See https://grafana.com/developers/dataplane/
 */
export function framesHaveTimeField(series: DataFrame[]): boolean {
  return series.some((frame) => frame.fields.some(isTimeField));
}

/**
 * Category labels for a frame: string field row values, or row indices as strings.
 */
export function resolveCategoriesFromFrame(frame: DataFrame): string[] {
  const categoryField = findCategoryField(frame);
  return resolveCategoriesFromField(categoryField, frame.length);
}

export function resolveCategoriesFromField(field: Field<string> | undefined, frameLength: number): string[] {
  return field?.values ?? Array.from({ length: frameLength }, (_, i) => i.toString());
}

/** One numeric field mapped to name, positional values, and color. */
export interface MappedNumericField {
  field: Field<number>;
  name: string;
  color: string;
}

/**
 * Map every numeric field in a frame to display metadata shared by converters and legends.
 */
export function mapNumericFields(
  frame: FieldTypedDataFrame<unknown, EChartsFieldConfig>,
  series: DataFrame[],
  theme: GrafanaTheme2
): MappedNumericField[] {
  return frame.fields
    .filter(isNumberField) // numeric fields only
    .map((field) => ({
      field,
      name: getFieldDisplayName(field, frame, series),
      color: getSeriesColor(field, theme),
    }));
}

export interface TimeSeriesFieldRef<T> {
  frame: FieldTypedDataFrame<T, EChartsFieldConfig>;
  frameIndex: number;
  /**
   * Always numeric: the walk below only yields fields that pass `isNumberField`,
   * so callers get `Field<number>` regardless of how wide the frame's `T` is.
   */
  field: Field<number>;
  fieldIndex: number;
  timeField: Field<number>;
}

/**
 * Resolve the time (or fallback X) field for a frame, matching timeSeries converter logic.
 */
export function resolveTimeField(frame: DataFrame) {
  let timeField = frame.fields.find(isTimeField);
  if (!timeField) {
    timeField = frame.fields.find(isNumberField);
  }
  return timeField;
}

/**
 * Iterate numeric value fields across all frames that have a usable time/X field.
 * Skips frames with no time or numeric fallback field.
 */
export function forEachTimeSeriesField<T>(
  series: Array<FieldTypedDataFrame<T, EChartsFieldConfig>>,
  callback: (ref: TimeSeriesFieldRef<T>) => void
): void {
  // @todo convert to for loop
  series.forEach((frame, frameIndex) => {
    const timeField = resolveTimeField(frame);
    if (!timeField) {
      return;
    }

    // @todo convert to for loop
    frame.fields.forEach((field, fieldIndex) => {
      if (!isNumberField(field) || field.name === timeField.name) {
        return;
      }
      callback({ frame, frameIndex, field, fieldIndex, timeField });
    });
  });
}

/**
 * Flatten frames to numeric fields in the same order as `timeSeriesToEChartsOption` emits series.
 */
export function collectTimeSeriesFields(series: DataFrame[]): Field[] {
  const fields: Field[] = [];
  forEachTimeSeriesField(series, ({ field }) => {
    fields.push(field);
  });
  return fields;
}

/**
 * The stacked fields of all frames joined into one frame on their time field.
 * ECharts stacks bars by data index on a time axis, so stacked series from
 * frames with different timestamps must share one index first. Core Bar chart
 * joins the same way (`prepSeries`). The other fields stay in their own frames,
 * on their own timestamps, so a line overlay gets no null at each timestamp of
 * another query and stays continuous, as in core. The joined frame takes the
 * place of the first stacked frame, so the series keep the query order. With
 * stacked fields in fewer than two frames, the frames pass through unchanged.
 * https://echarts.apache.org/en/option.html#series-bar.stack
 */
export function joinStackedFieldsOnTime<V, C>(
  frames: Array<FieldTypedDataFrame<V, C>>,
  isStacked: (field: Field) => boolean
): Array<FieldTypedDataFrame<V, C>> {
  const stackedParts: Array<FieldTypedDataFrame<V, C>> = [];
  // The frames in query order; `null` holds the place of the joined frame, at the first stacked frame.
  const ordered: Array<FieldTypedDataFrame<V, C> | null> = [];
  for (const frame of frames) {
    const timeField = frame.fields.find(isTimeField);
    const stacked = timeField ? frame.fields.filter((field) => isNumberField(field) && isStacked(field)) : [];
    if (!timeField || stacked.length === 0) {
      ordered.push(frame);
      continue;
    }
    if (stackedParts.length === 0) {
      ordered.push(null);
    }
    stackedParts.push({ ...frame, fields: [timeField, ...stacked] });
    const others = frame.fields.filter((field) => !stacked.includes(field));
    if (others.some((field) => field !== timeField && isNumberField(field))) {
      ordered.push({ ...frame, fields: others });
    }
  }
  if (stackedParts.length < 2) {
    return frames;
  }
  const joined = outerJoinDataFrames({ frames: stackedParts, keepDisplayNames: true });
  return joined ? ordered.map((frame) => frame ?? joined) : frames;
}
