import { measureText } from '@grafana/ui';

/**
 * The width in pixels of the widest axis label, measured as core measures its axis
 * labels: `measureText` of `@grafana/ui` with the theme font at the axis font size.
 * https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/utils/measureText.ts
 */
export function measureAxisLabelWidth(labels: string[], fontSize: number): number {
  return labels.reduce((widest, label) => Math.max(widest, measureText(label, fontSize).width), 0);
}
