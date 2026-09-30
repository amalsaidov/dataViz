import {
  buildHistogram,
  cacheFieldDisplayNames,
  type DataFrame,
  DataFrameType,
  type Field,
  FieldType,
  getFieldDisplayName,
  getHistogramFields,
  type GrafanaTheme2,
  histogramFieldsToFrame,
  type HistogramTransformerOptions,
  joinHistograms,
} from '@grafana/data';

/**
 * The buckets of a histogram, as the core Histogram panel makes them. The raw frames do not change:
 * the renderer makes the buckets again at each render, so a saved spec never has bucketed data.
 * Core source: https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/histogram/HistogramPanel.tsx
 */
export interface HistogramModel {
  /** The lower bound of each bucket. Its `display` formats the x axis and the tooltip header. */
  xMin: Field;
  /** The upper bound of each bucket. */
  xMax: Field;
  /** One count field for each series, with the same rows as `xMin`. */
  counts: Field[];
  /** The display name of each count field, in the order of `counts`. */
  names: string[];
}

/**
 * Make the histogram of the frames, with the same steps as core `HistogramPanel`:
 * 1. One frame, or only heatmap frames: use the explicit bucket fields (`xMin`, `xMax`) of the data.
 * 2. Else, bucket the numeric fields with `buildHistogram` of `@grafana/data`.
 * Returns `undefined` when the frames have no numeric field ("No histogram found in response").
 * https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/transformations/transformers/histogram.ts
 */
export function buildHistogramModel(
  frames: DataFrame[],
  options: HistogramTransformerOptions,
  theme: GrafanaTheme2
): HistogramModel | undefined {
  if (frames.length === 0) {
    return undefined;
  }
  // Core writes the display names into the field state of the frames. Copies keep the input frames unchanged.
  const copies = frames.map((frame) => ({ ...frame, fields: frame.fields.map((field) => ({ ...field })) }));
  cacheFieldDisplayNames(copies);

  const frame = getExplicitHistogram(copies, theme) ?? getBuiltHistogram(copies, options, theme);
  if (!frame || frame.fields.length < 3) {
    return undefined;
  }
  const [xMin, xMax, ...counts] = frame.fields;
  return { xMin, xMax, counts, names: counts.map((field) => getFieldDisplayName(field, frame)) };
}

/** Step 1 of `buildHistogramModel`: the buckets that the data source made. */
function getExplicitHistogram(frames: DataFrame[], theme: GrafanaTheme2): DataFrame | undefined {
  const heatmapOnly = frames.every(
    (frame) => frame.meta?.type === DataFrameType.HeatmapCells || frame.meta?.type === DataFrameType.HeatmapRows
  );
  if (frames.length !== 1 && !heatmapOnly) {
    return undefined;
  }
  const histograms = frames.map((frame) => getHistogramFields(frame)).filter((hist) => hist != null);
  return histograms.length ? histogramFieldsToFrame(joinHistograms(histograms), theme) : undefined;
}

/** Step 2 of `buildHistogramModel`: bucket the raw values. */
function getBuiltHistogram(
  frames: DataFrame[],
  options: HistogramTransformerOptions,
  theme: GrafanaTheme2
): DataFrame | undefined {
  const histogram = buildHistogram(frames, sanitizeHistogramOptions(options), theme);
  return histogram ? histogramFieldsToFrame(histogram, theme) : undefined;
}

/**
 * The bucket options that `buildHistogram` can use. Each value that is not valid is removed, so the default
 * applies. The panel does not show an error for these values, as core does not.
 * - A size that is not a positive finite number: the automatic size. Core does this for a size of 0 or less
 *   (`if (!bucketSize || bucketSize < 0)`).
 * - A count that is not a positive finite number: the default count. Core gives `NaN` buckets for a count of 0
 *   or `NaN`. For a negative count, core uses the smallest bucket size that is not less than the smallest gap
 *   between two values.
 * - An offset that is not a finite number: no offset. Core gives `NaN` buckets for it.
 * https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/transformations/transformers/histogram.ts
 */
export function sanitizeHistogramOptions(options: HistogramTransformerOptions): HistogramTransformerOptions {
  const positive = (value: unknown) =>
    typeof value === 'number' && value > 0 && Number.isFinite(value) ? value : undefined;
  const finite = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);
  return {
    bucketCount: positive(options.bucketCount),
    bucketSize: positive(options.bucketSize),
    bucketOffset: finite(options.bucketOffset),
    combine: options.combine === true,
  };
}

/** The most buckets that the chart draws. Core has no limit, but many more bars can hang the page. */
export const MAX_HISTOGRAM_BUCKETS = 10_000;

/**
 * True when the buckets are names, not numbers. Core gives such buckets for heatmap-rows frames (`le` buckets),
 * and draws them on an ordinal axis (`isOrdinalX` in core `prepConfig`).
 * https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/histogram/Histogram.tsx
 */
export function isOrdinalHistogram(model: HistogramModel): boolean {
  return model.xMin.type === FieldType.string || model.xMax.type === FieldType.string;
}

/** True when the cartesian panel draws a histogram of its frames (`PanelOptions.histogram`). */
export function isHistogramPanel(options: { histogram?: boolean }): boolean {
  return options.histogram === true;
}

/** The core histogram options of a panel. */
export function getHistogramOptions(options: HistogramTransformerOptions): HistogramTransformerOptions {
  const { bucketCount, bucketSize, bucketOffset, combine } = options;
  return { bucketCount, bucketSize, bucketOffset, combine };
}
