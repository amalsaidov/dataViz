import { type AnnotationEventUIModel, dateTimeFormat, systemDateFormats } from '@grafana/data';
import { type TimeZone } from '@grafana/schema';

// The annotation that a user adds from the chart, before Grafana saves it. Core keeps the same
// range in `TimeSeriesPanel` (`newAnnotationRange`) and saves it from `AnnotationEditor`.
// https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/timeseries/plugins/annotations/AnnotationEditor.tsx
// https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/annotate-visualizations/#add-annotations

/** A new annotation in epoch ms: a point when `from` equals `to`, else a region. */
export interface AnnotationDraft {
  from: number;
  to: number;
}

/** The fields of the editor form. */
export interface AnnotationDraftForm {
  description: string;
  tags: string[];
}

/** A draft from two times in any order. */
export function draftFromRange(start: number, end: number): AnnotationDraft {
  return { from: Math.min(start, end), to: Math.max(start, end) };
}

/**
 * The event for `PanelContext.onAnnotationCreate`. As core, the times are rounded to whole ms,
 * and the dashboard makes a region when `from` and `to` differ.
 * https://github.com/grafana/grafana/blob/main/public/app/features/dashboard-scene/scene/setDashboardPanelContext.ts
 */
export function toAnnotationEvent(draft: AnnotationDraft, form: AnnotationDraftForm): AnnotationEventUIModel {
  return {
    from: Math.round(draft.from),
    to: Math.round(draft.to),
    description: form.description,
    tags: form.tags,
  };
}

/** The time of the draft in the full date format, and ` - <end>` for a region, as core. */
export function formatDraftTime(draft: AnnotationDraft, timeZone?: TimeZone): string {
  const format = (value: number) => dateTimeFormat(value, { format: systemDateFormats.fullDate, timeZone });
  return draft.to > draft.from ? `${format(draft.from)} - ${format(draft.to)}` : format(draft.from);
}
