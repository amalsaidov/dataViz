import { dateTimeFormat, systemDateFormats } from '@grafana/data';
import { type TimeZone } from '@grafana/schema';
import { type ResolvedAnnotation } from 'lib/grafana/annotations';
import { type TooltipModel } from 'lib/echarts/tooltip/types';

/**
 * The tooltip of an annotation marker, as core's `getAnnotationTooltip`: the time in the full
 * date format, and ` - <end>` for a region. The sources give the data links, as core `AnnotationMarker`.
 * https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/timeseries/plugins/annotations/getAnnotationTooltip.tsx
 * https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/datetime/formatter.ts
 */
export function buildAnnotationTooltipModel(annotation: ResolvedAnnotation, timeZone?: TimeZone): TooltipModel {
  const format = (value: number) => dateTimeFormat(value, { format: systemDateFormats.fullDate, timeZone });
  const time =
    annotation.timeEnd == null ? format(annotation.time) : `${format(annotation.time)} - ${format(annotation.timeEnd)}`;
  const { links } = annotation;
  return {
    header: { label: '', value: time },
    rows: [],
    annotation: {
      title: annotation.title,
      text: annotation.text,
      tags: annotation.tags ?? [],
      ...(links && { sources: links.fields.map((field) => ({ field, rowIndex: links.rowIndex })) }),
    },
  };
}
