import { type AnnotationEventUIModel, dateTimeFormat, systemDateFormats } from '@grafana/data';
import { type TimeZone } from '@grafana/schema';
import { type AnnotationDraft } from 'lib/echarts/annotationGestures';

// The Grafana side of the annotation that a user adds from the chart (`AnnotationDraft`, in
// lib/echarts/annotationGestures.ts): the event that Grafana saves, and the time text.
// Core saves the range from `AnnotationEditor`.
// https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/timeseries/plugins/annotations/AnnotationEditor.tsx
// https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/annotate-visualizations/#add-annotations

/** The fields of the editor form. */
export interface AnnotationDraftForm {
  description: string;
  tags: string[];
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
