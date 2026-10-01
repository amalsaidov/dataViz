import {
  applyNullInsertThreshold,
  cacheFieldDisplayNames,
  colorManipulator,
  type DataFrame,
  FALLBACK_COLOR,
  type Field,
  FieldColorModeId,
  FieldType,
  formattedValueToString,
  getActiveThreshold,
  getFieldConfigWithMinMax,
  getFieldDisplayName,
  type GrafanaTheme2,
  nullToValue,
  outerJoinDataFrames,
  sortDataFrame,
  SpecialValueMatch,
  type Threshold,
  ThresholdsMode,
  type TimeRange,
} from '@grafana/data';
import { MappingType } from '@grafana/schema';
import { getThresholdItems, getTimelineLegendItems } from './legend';
import {
  type TimelineIssue,
  type TimelineLane,
  type TimelineMode,
  type TimelinePrepareResult,
  type TimelineSegment,
} from './types';

/**
 * Grafana side of the timeline family: frames in, `TimelineModel` out. A slim port of
 * core's `prepareTimelineFields` and the Changes-mode walk of its `drawPaths`, which
 * `@grafana/data` does not export:
 * https://github.com/grafana/grafana/blob/main/public/app/core/components/TimelineChart/utils.ts
 * https://github.com/grafana/grafana/blob/main/public/app/core/components/TimelineChart/timeline.ts
 *
 * Value meanings are core's: `undefined` continues the state before it (a row that only
 * another frame has), `null`/`NaN` is a gap unless a value mapping maps it, and the last
 * state of a lane runs to the end of the time range. See `data-plane/timeline.md`.
 */

/**
 * `JoinNullMode` "retain": the join keeps `null`s and fills rows a frame does not have
 * with `undefined`. The constant is `@grafana/data` internal (`joinDataFrames.d.ts`).
 */
const NULL_RETAIN = 1;

export interface PrepareTimelineOptions {
  /** Core's "Merge equal consecutive values". `samples` mode never merges. */
  mergeValues: boolean;
  /** `changes` (state timeline) when unset. */
  mode?: TimelineMode;
  timeRange: TimeRange;
  theme: GrafanaTheme2;
}

/** Whether a value mapping of the given special match exists on the field. */
export const hasSpecialMappedValue = (field: Field, match: SpecialValueMatch): boolean =>
  field.config.mappings?.some(
    (mapping) => mapping.type === MappingType.SpecialValue && mapping.options.match === match
  ) ?? false;

/** Core's `shouldDrawYValue`: which values draw a bar. `undefined`, `null` and `NaN` do not, unless mapped. */
export function shouldDrawValue(value: unknown, mappedNull: boolean, mappedNaN: boolean): boolean {
  if (typeof value === 'boolean' || typeof value === 'string') {
    return true;
  }
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return true;
  }
  if (value === null && mappedNull) {
    return true;
  }
  if (Number.isNaN(value) && mappedNaN) {
    return true;
  }
  return !!value;
}

/**
 * Replace the values of a number field in threshold colour mode with the label of their
 * threshold step, so `mergeValues` merges by step, not by number. Core's
 * `mergeThresholdValues`.
 */
function mergeThresholdValues(field: Field, theme: GrafanaTheme2): Field | undefined {
  const thresholds = field.config.thresholds;
  if (field.type !== FieldType.number || !thresholds || !thresholds.steps.length) {
    return undefined;
  }

  const items = getThresholdItems(field.config, theme);
  const thresholdToText = new Map<Threshold, string>();
  const textToColor = new Map<string, string>();
  items.forEach((item, i) => {
    thresholdToText.set(thresholds.steps[i], item.label);
    textToColor.set(item.label, item.color ?? FALLBACK_COLOR);
  });

  const raw: unknown[] = field.values;
  let input = raw.map((v) => (typeof v === 'number' ? v : null));
  if (thresholds.mode === ThresholdsMode.Percentage) {
    const { min, max } = getFieldConfigWithMinMax(field);
    const lo = min ?? 0;
    const delta = (max ?? 0) - lo;
    input = input.map((v) => (v == null ? v : ((v - lo) / delta) * 100));
  }

  return {
    ...field,
    type: FieldType.string,
    values: input.map((v) => (v == null ? v : thresholdToText.get(getActiveThreshold(v, thresholds.steps)))),
    display: (value) => ({ text: String(value), color: textToColor.get(String(value)), numeric: NaN }),
  };
}

/** A value from `field.config.custom`, which `@grafana/data` types as `any`. */
function customValue(field: Field, key: string): unknown {
  const custom: unknown = field.config.custom;
  return typeof custom === 'object' && custom !== null && key in custom ? Reflect.get(custom, key) : undefined;
}

/** A number from `field.config.custom`. */
function customNumber(field: Field, key: 'fillOpacity' | 'lineWidth'): number | undefined {
  const value = customValue(field, key);
  return typeof value === 'number' ? value : undefined;
}

/**
 * "Connect null values" (`custom.spanNulls`): a run of `null`s becomes `undefined`, which
 * continues the state before it. With a number, only a run whose next value comes less than
 * that many milliseconds after the value before the run. Core's `nullToUndefThreshold`.
 * https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/transformations/transformers/nulls/nullToUndefThreshold.ts
 */
export function spanNullValues(values: unknown[], times: number[], spanNulls: unknown): unknown[] {
  if (spanNulls === true) {
    return values.map((value) => (value === null ? undefined : value));
  }
  if (typeof spanNulls !== 'number' || spanNulls <= 0) {
    return values;
  }
  const out = [...values];
  let prevTime: number | undefined;
  let nullIdx: number | undefined;
  for (let i = 0; i < out.length; i++) {
    if (out[i] === null) {
      nullIdx ??= i;
      continue;
    }
    if (nullIdx != null && prevTime != null && times[i] - prevTime < spanNulls) {
      for (let j = nullIdx; j < i; j++) {
        out[j] = undefined;
      }
    }
    nullIdx = undefined;
    prevTime = times[i];
  }
  return out;
}

const isNumericTimeField = (field: Field) => field.type === FieldType.time && typeof field.values[0] === 'number';

/** Sort the frame by a field when the field is not ascending (core's internal `maybeSortFrame`). */
function sortIfNeeded(frame: DataFrame, fieldIdx: number): DataFrame {
  // Nulls are skipped: `null < 1` is true, and a null time is reported, not sorted.
  let previous = -Infinity;
  const values: unknown[] = frame.fields[fieldIdx].values;
  for (const value of values) {
    if (typeof value !== 'number') {
      continue;
    }
    if (value < previous) {
      return sortDataFrame(frame, fieldIdx);
    }
    previous = value;
  }
  return frame;
}

/**
 * A frame with a second time field holds state end times. Join the end times into the
 * start times as rows of `null`, so each state stops at its end time.
 */
function joinEndTimes(frame: DataFrame, endFieldIdx: number): DataFrame {
  const startFrame: DataFrame = { ...frame, fields: frame.fields.filter((_, i) => i !== endFieldIdx) };
  const endFrame: DataFrame = { length: frame.length, fields: [frame.fields[endFieldIdx]] };
  const joined = outerJoinDataFrames({
    frames: [startFrame, endFrame],
    keepDisplayNames: true,
    nullMode: () => NULL_RETAIN,
  });
  if (!joined) {
    return frame;
  }
  // An end row is a gap (`null`), never a continued state (`undefined`).
  joined.fields.forEach((field, i) => {
    if (i > 0) {
      for (let row = 0; row < field.values.length; row++) {
        if (field.values[row] == null) {
          field.values[row] = null;
        }
      }
    }
  });
  return joined;
}

/** Keep the time field and the value fields a timeline can draw. */
function graphableFields(frame: DataFrame, mergeValues: boolean, theme: GrafanaTheme2): Field[] {
  const fields: Field[] = [];
  for (const field of frame.fields) {
    switch (field.type) {
      case FieldType.time:
        if (typeof field.values[0] === 'number') {
          fields.push(field);
        }
        break;
      case FieldType.enum:
      case FieldType.number: {
        const merged =
          mergeValues && field.config.color?.mode === FieldColorModeId.Thresholds
            ? mergeThresholdValues(field, theme)
            : undefined;
        fields.push(merged ?? field);
        break;
      }
      case FieldType.boolean:
      case FieldType.string:
        fields.push(field);
        break;
    }
  }
  return fields;
}

/**
 * The fix steps for each timeline data issue (#930). Each message starts with the core text, so the panel reads
 * like the core state timeline. Data plane: https://grafana.com/developers/dataplane/timeseries
 */
export const TIMELINE_ISSUE_MESSAGES = {
  'no-time-field': 'Data does not have a time field. Add a time field.',
  'no-graphable-fields': 'No graphable fields. Add a string, boolean or number field for the states.',
  'empty-state-fields': 'The state fields have no values.',
};

const issue = (reason: TimelineIssue['reason'], message: string): TimelinePrepareResult => ({
  issue: { reason, message },
});

/** Frames with a time field and at least one value field, each sorted by time. */
function prepareFrames(
  series: DataFrame[],
  { mergeValues, timeRange, theme }: PrepareTimelineOptions
): { frames: DataFrame[] } | TimelinePrepareResult {
  cacheFieldDisplayNames(series);

  let hasTimeField = false;
  const frames: DataFrame[] = [];

  for (let frame of series) {
    const timeIdx = frame.fields.map((field, i) => (isNumericTimeField(field) ? i : -1)).filter((i) => i !== -1);
    if (timeIdx.length === 0) {
      continue;
    }
    hasTimeField = true;
    frame = sortIfNeeded(frame, timeIdx[0]);
    if (timeIdx.length > 1) {
      frame = joinEndTimes(frame, timeIdx[1]);
    }
    // Reads `custom.insertNulls` ("Disconnect values") of each field.
    frame = nullToValue(
      applyNullInsertThreshold({
        frame,
        refFieldPseudoMin: timeRange.from.valueOf(),
        refFieldPseudoMax: timeRange.to.valueOf(),
      })
    );

    const fields = graphableFields(frame, mergeValues, theme);
    if (fields.length > 1) {
      frames.push({ ...frame, fields });
    }
  }

  if (!hasTimeField) {
    return issue('no-time-field', TIMELINE_ISSUE_MESSAGES['no-time-field']);
  }
  if (!frames.length) {
    return issue('no-graphable-fields', TIMELINE_ISSUE_MESSAGES['no-graphable-fields']);
  }
  // A null state draws no bar unless a value mapping maps null, so all null states draw an empty chart.
  const states = frames.flatMap((frame) => frame.fields.filter((field) => field.type !== FieldType.time));
  const mapsNull = (field: Field) =>
    hasSpecialMappedValue(field, SpecialValueMatch.Null) || hasSpecialMappedValue(field, SpecialValueMatch.NullAndNaN);
  if (states.every((field) => !mapsNull(field) && field.values.every((value) => value == null))) {
    return issue('empty-state-fields', TIMELINE_ISSUE_MESSAGES['empty-state-fields']);
  }
  const invalid = frames.find((frame) =>
    frame.fields.find((field) => field.type === FieldType.time)?.values.some((value) => value == null)
  );
  if (invalid) {
    return issue(
      'null-time-value',
      invalid.refId
        ? `Query ${invalid.refId} returned a time field with null values; filter out rows with empty timestamps`
        : 'A query returned a time field with null values; filter out rows with empty timestamps'
    );
  }
  return { frames };
}

/**
 * Fill colour of a bar: the value colour with `fillOpacity`, except when the colour
 * already has an alpha (`#rrggbbaa`, e.g. a threshold with opacity). Core's `getFillColor`.
 */
function getFillColor(color: string, fillOpacity: number | undefined): string {
  if (color[0] === '#' && color.length === 9) {
    return color;
  }
  return colorManipulator.alpha(color, (fillOpacity ?? 100) / 100);
}

/**
 * The bars of one lane: core's walk over the joined values. `changes` mode runs each
 * state to the next one, `samples` mode gives each drawable sample its own cell.
 */
function buildSegments(
  field: Field,
  times: number[],
  { mergeValues, mode, timeRange, theme }: PrepareTimelineOptions
): TimelineSegment[] {
  const discrete = !field.config.color?.mode?.startsWith('continuous-');
  const mappedNull =
    discrete &&
    (hasSpecialMappedValue(field, SpecialValueMatch.Null) ||
      hasSpecialMappedValue(field, SpecialValueMatch.NullAndNaN));
  const mappedNaN =
    discrete &&
    (hasSpecialMappedValue(field, SpecialValueMatch.NaN) || hasSpecialMappedValue(field, SpecialValueMatch.NullAndNaN));
  const rangeEnd = timeRange.to.valueOf();
  // A mapped null draws a bar, so it is not connected. Samples mode has no states to connect.
  const raw: unknown[] = field.values;
  const values = mode === 'samples' || mappedNull ? raw : spanNullValues(raw, times, customValue(field, 'spanNulls'));
  const segments: TimelineSegment[] = [];

  for (let ix = 0; ix < values.length; ix++) {
    const value = values[ix];
    if (!shouldDrawValue(value, mappedNull, mappedNaN)) {
      continue;
    }

    // A state runs over rows that are `undefined` (not in this lane's frame) and, when
    // merging, over rows with the same value. A sample is one row.
    let next = ix + 1;
    if (mode !== 'samples') {
      while (next < values.length && (values[next] === undefined || (mergeValues && values[next] === value))) {
        next++;
      }
    }

    const display = field.display?.(value);
    const color = display?.color ?? FALLBACK_COLOR;
    const fillColor = getFillColor(color, customNumber(field, 'fillOpacity'));
    const start = times[ix];
    segments.push({
      start,
      end: mode === 'samples' ? start : next === values.length ? Math.max(rangeEnd, start) : times[next],
      text: display ? formattedValueToString(display) : String(value),
      color,
      fillColor,
      textColor: theme.colors.getContrastText(fillColor, 3),
      rowIndex: ix,
    });
    ix = next - 1;
  }
  return segments;
}

/**
 * Build the timeline model: one lane per value field over all frames, joined on time.
 * Returns an issue with core's message when the data cannot be drawn.
 */
export function prepareTimeline(series: DataFrame[], options: PrepareTimelineOptions): TimelinePrepareResult {
  // Core's status history passes `mergeValues: false` (`StatusHistoryPanel.tsx`).
  const opts = options.mode === 'samples' ? { ...options, mergeValues: false } : options;
  if (series.length === 0) {
    return { model: { lanes: [], legendItems: [] } };
  }
  const prepared = prepareFrames(series, opts);
  if (!('frames' in prepared)) {
    return prepared;
  }
  const { frames } = prepared;

  // Outer join on the first time field. Rows one frame does not have are `undefined`,
  // which continues that frame's state (core's GraphNG join with `NULL_RETAIN`).
  // https://grafana.com/developers/plugin-tools/key-concepts/data-frames
  const joined = outerJoinDataFrames({ frames, keepDisplayNames: true, nullMode: () => NULL_RETAIN }) ?? frames[0];
  const timeField = joined.fields.find((field) => field.type === FieldType.time);
  const timeValues: unknown[] = timeField?.values ?? [];
  const times = timeValues.map(Number);
  // Core sizes status history cells from the first interval of the joined times. With one
  // sample there is no interval, and core draws no cell.
  const sampleInterval = opts.mode === 'samples' && times.length > 1 ? times[1] - times[0] : undefined;
  const drawsSegments = opts.mode !== 'samples' || sampleInterval != null;

  const lanes: TimelineLane[] = joined.fields
    .filter((field) => field.type !== FieldType.time)
    .map((field) => ({
      // Core names each lane from the joined frame, which also numbers equal names
      // (`SensorA 1`, `SensorA 2`).
      name: getFieldDisplayName(field, joined),
      field,
      lineWidth: customNumber(field, 'lineWidth') ?? 0,
      segments: drawsSegments ? buildSegments(field, times, opts) : [],
    }));

  const valueFields = frames.flatMap((frame) => frame.fields.filter((field) => field.type !== FieldType.time));
  const legendItems = getTimelineLegendItems(valueFields, opts.theme);
  return { model: { lanes, legendItems, sampleInterval } };
}
