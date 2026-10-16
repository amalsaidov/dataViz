import {
  type DataFrame,
  DataTransformerID,
  type DataTransformerInfo,
  type SynchronousDataTransformerInfo,
  standardTransformersRegistry,
  type TimeRange,
} from '@grafana/data';
import { HeatmapCalculationMode, type HeatmapCalculationOptions, ScaleDistribution } from '@grafana/schema';
import { debug, LOG_LEVELS } from 'development';

function isSynchronous(info: DataTransformerInfo | undefined): info is SynchronousDataTransformerInfo {
  return info != null && 'transformer' in info && typeof info.transformer === 'function';
}

/** Core's heatmap transformer, once {@link preloadHeatmapCalculator} resolved it. */
let calculator: SynchronousDataTransformerInfo | undefined;

/**
 * Resolve core's heatmap transformer from the host registry. The registry
 * resolves transformers asynchronously (Grafana 13.1+; older hosts hold the
 * object itself), so the panel awaits this before its first render (see
 * `makeLazyPanel`). Never rejects: without a host transformer the panel draws
 * the raw frames.
 */
export async function preloadHeatmapCalculator(): Promise<void> {
  try {
    // Typed as a resolver, but a pre-13.1 host holds the info object itself.
    const item = standardTransformersRegistry.getIfExists(DataTransformerID.heatmap);
    const entry: DataTransformerInfo | (() => Promise<DataTransformerInfo>) | undefined = item?.transformation;
    const info = typeof entry === 'function' ? await entry() : entry;
    calculator = isSynchronous(info) ? info : undefined;
  } catch (error) {
    calculator = undefined;
    debug(`Heatmap calculation: cannot load the host transformer: ${String(error)}`, LOG_LEVELS.warn);
  }
}

/**
 * Core Grafana's calculation defaults: size-based buckets on a linear Y scale.
 * Mirrors `getCalculationObjectWithDefaults` in core's heatmap panel.
 */
function withDefaults(calculation?: HeatmapCalculationOptions): HeatmapCalculationOptions {
  return {
    xBuckets: { ...calculation?.xBuckets, mode: calculation?.xBuckets?.mode ?? HeatmapCalculationMode.Size },
    yBuckets: {
      ...calculation?.yBuckets,
      mode: calculation?.yBuckets?.mode ?? HeatmapCalculationMode.Size,
      scale: { ...calculation?.yBuckets?.scale, type: calculation?.yBuckets?.scale?.type ?? ScaleDistribution.Linear },
    },
  };
}

/**
 * Bin raw time series into one dense `heatmap-cells` frame (`xMin`, `yMin`,
 * `Count`) with core Grafana's own "Create heatmap" transformer, so the buckets
 * match core's heatmap panel exactly. The transformer lives in Grafana core,
 * not in `@grafana/data`, so it is read from the host's transformer registry.
 * https://grafana.com/docs/grafana/latest/panels-visualizations/query-transform-data/transform-data/#heatmap
 *
 * Returns `undefined` when the host has no such transformer (for example the
 * standalone renderer), it is not loaded yet, or the data has nothing to bin.
 */
export function calculateHeatmapFrames(
  frames: DataFrame[],
  calculation: HeatmapCalculationOptions | undefined,
  timeRange?: TimeRange
): DataFrame[] | undefined {
  if (!calculator) {
    debug('Heatmap calculation: host has no heatmap transformer', LOG_LEVELS.warn);
    return undefined;
  }
  try {
    // `timeRange` is read by core's calculation to align X buckets to the
    // dashboard range, but it is not part of the public options type.
    const options = { ...withDefaults(calculation), timeRange };
    return calculator.transformer(options, { interpolate: (value) => value })(frames);
  } catch (error) {
    // Core throws plain strings ("no heatmap fields found") on unusable data.
    debug(`Heatmap calculation failed: ${String(error)}`, LOG_LEVELS.warn);
    return undefined;
  }
}
