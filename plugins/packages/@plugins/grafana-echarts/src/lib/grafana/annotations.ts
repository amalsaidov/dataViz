import { type DataFrame, type Field, FieldType, type GrafanaTheme2 } from '@grafana/data';
import { DEFAULT_ANNOTATION_COLOR } from '@grafana/ui';

// Reads the annotation frames of `PanelData.annotations` into a chart-agnostic model that the
// ECharts option builder (lib/echarts/options/annotations.ts) draws. Grafana's dashboard layer
// already gives each event its `time`, `timeEnd`, `isRegion` and `color` fields.
// https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/annotate-visualizations/
// Core reference: public/app/plugins/panel/timeseries/plugins/AnnotationsPlugin.tsx (the `draw` hook).

/** One annotation event: a point at `time`, or a region from `time` to `timeEnd`. */
export interface ResolvedAnnotation {
  time: number;
  /** Set only for a region. */
  timeEnd?: number;
  color: string;
}

/**
 * Resolve the annotation frames to points and regions with theme colors.
 *
 * As core, a frame named `exemplar` or `xymark`, an empty frame, and a frame with no time
 * field draw nothing (`getXAnnotationFrames`). An event is a region only when `isRegion` is
 * true and it has a `timeEnd`.
 */
export function readAnnotations(frames: DataFrame[] | undefined, theme: GrafanaTheme2): ResolvedAnnotation[] {
  return (frames ?? []).filter(isTimeAnnotationFrame).flatMap((frame) => {
    const time = fieldByName(frame, 'time');
    const timeEnd = fieldByName(frame, 'timeEnd');
    const isRegion = fieldByName(frame, 'isRegion');
    const color = fieldByName(frame, 'color');
    if (!time) {
      return [];
    }
    const events: ResolvedAnnotation[] = [];
    for (let i = 0; i < frame.length; i++) {
      const start: unknown = time.values[i];
      if (typeof start !== 'number') {
        continue;
      }
      const end: unknown = timeEnd?.values[i];
      const name: unknown = color?.values[i];
      // `getColorByName` gives a CSS color for a palette name and keeps a CSS color as it is.
      const resolved = theme.visualization.getColorByName(
        typeof name === 'string' && name !== '' ? name : DEFAULT_ANNOTATION_COLOR
      );
      events.push({
        time: start,
        ...(isRegion?.values[i] === true && typeof end === 'number' ? { timeEnd: end } : {}),
        color: resolved,
      });
    }
    return events;
  });
}

/** Core's filter of the frames that draw on the x axis (`getXAnnotationFrames`). */
function isTimeAnnotationFrame(frame: DataFrame): boolean {
  return (
    frame.name !== 'exemplar' &&
    frame.name !== 'xymark' &&
    frame.length > 0 &&
    frame.fields.some((field) => field.type === FieldType.time)
  );
}

function fieldByName(frame: DataFrame, name: string): Field | undefined {
  return frame.fields.find((field) => field.name === name);
}
