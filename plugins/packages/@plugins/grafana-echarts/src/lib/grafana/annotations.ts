import { type DataFrame, type Field, FieldType, type GrafanaTheme2 } from '@grafana/data';
import { type VizAnnotations } from '@grafana/schema';
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
  /** The tooltip content. `title` and `text` can contain HTML, which the tooltip sanitizes. */
  title?: string;
  text?: string;
  tags?: string[];
  /**
   * The fields of the frame that have data links, and the row of the event. Set only when a field
   * has links. The tooltip shows a link only when the host gave the field its `getLinks`, as core
   * `getFieldDisplayLinks`. Grafana 13.2 does not do this for annotation frames (grafana/grafana#119619).
   * https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/VizTooltip/utils.ts
   */
  links?: { fields: Field[]; rowIndex: number };
  /** The index of the frame of the event in the frames that draw: its row of multi-lane markers. */
  lane?: number;
}

/** The annotation panel options (`options.annotations`) as the chart draws them. */
export interface AnnotationDisplay {
  /** `undefined` uses the default of the chart. 0 draws no line. */
  lineWidth?: number;
  /** `undefined` uses the default of the chart. 0 draws no band. */
  regionOpacity?: number;
  multiLane: boolean;
}

/**
 * Resolve the annotation frames to points and regions with theme colors.
 *
 * As core, a frame named `exemplar` or `xymark`, an empty frame, and a frame with no time
 * field draw nothing (`getXAnnotationFrames`). An event is a region only when `isRegion` is
 * true and it has a `timeEnd`.
 */
export function readAnnotations(frames: DataFrame[] | undefined, theme: GrafanaTheme2): ResolvedAnnotation[] {
  return (frames ?? []).filter(isTimeAnnotationFrame).flatMap((frame, lane) => {
    const time = fieldByName(frame, 'time');
    const timeEnd = fieldByName(frame, 'timeEnd');
    const isRegion = fieldByName(frame, 'isRegion');
    const color = fieldByName(frame, 'color');
    const title = fieldByName(frame, 'title');
    const text = fieldByName(frame, 'text');
    const tags = fieldByName(frame, 'tags');
    if (!time) {
      return [];
    }
    // Core reads the links of each field of the frame (`AnnotationMarker`).
    const linkFields = frame.fields.filter((field) => (field.config.links?.length ?? 0) > 0);
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
        title: asText(title?.values[i]),
        text: asText(text?.values[i]),
        tags: asTags(tags?.values[i]),
        ...(linkFields.length > 0 ? { links: { fields: linkFields, rowIndex: i } } : {}),
        lane,
      });
    }
    return events;
  });
}

/** The number of marker lanes: one for each annotation frame that draws (core `annotationLanes`). */
export function countAnnotationLanes(frames: DataFrame[] | undefined): number {
  return (frames ?? []).filter(isTimeAnnotationFrame).length;
}

/**
 * Read the core annotation panel options (`VizAnnotations` in @grafana/schema).
 * Core draws the lines and the bands only when both the line width and the band opacity are more than 0.
 * With `multiLane` and no width or opacity, core draws no lines and no bands.
 * Core reference: `shouldRenderAnnotationLine` and `shouldRenderAnnotationRegion` in
 * public/app/plugins/panel/timeseries/plugins/utils.ts, and the `draw` hook of `AnnotationsPlugin.tsx`.
 */
export function readAnnotationDisplay(options: VizAnnotations | undefined): AnnotationDisplay {
  const multiLane = options?.multiLane === true;
  const width = options?.lines?.width;
  const opacity = options?.regions?.opacity;
  const isOn = (value: number | undefined) => (value === undefined ? !multiLane : value > 0);
  if (!isOn(width) || !isOn(opacity)) {
    return { lineWidth: 0, regionOpacity: 0, multiLane };
  }
  return { lineWidth: width, regionOpacity: opacity, multiLane };
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

/** A non-empty string, else `undefined`. */
function asText(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/** The string tags of an event (core's `tags` field holds a string array for each event). */
function asTags(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value.filter((tag): tag is string => typeof tag === 'string') : undefined;
}

function fieldByName(frame: DataFrame, name: string): Field | undefined {
  return frame.fields.find((field) => field.name === name);
}
