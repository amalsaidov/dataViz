import { measureText } from '@grafana/ui';

/**
 * The width in pixels of the widest axis label, measured as core measures its axis
 * labels: `measureText` of `@grafana/ui` with the theme font at the axis font size.
 * https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/utils/measureText.ts
 */
export function measureAxisLabelWidth(labels: string[], fontSize: number): number {
  return labels.reduce((widest, label) => Math.max(widest, measureText(label, fontSize).width), 0);
}

/**
 * The advance widths in pixels of the Inter characters of a default time label, at 12 px, as Chromium measures
 * them. Inter does not kern these characters, so a label is as wide as the sum of its characters.
 * The standalone renderer does not embed Inter and draws with a fallback font. Thus `measureText` gives it a
 * different width than Grafana, and an other time grid step (#1088). This table gives both the same width.
 * Time formats of Grafana: https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/#date_formats
 */
const INTER_12PX: Record<string, number> = {
  '0': 7.5703125,
  '1': 4.880859375,
  '2': 7.318359375,
  '3': 7.412109375,
  '4': 7.751953125,
  '5': 7.294921875,
  '6': 7.44140625,
  '7': 6.791015625,
  '8': 7.423828125,
  '9': 7.44140625,
  ':': 3.45703125,
  '/': 4.32421875,
  '-': 5.51953125,
  '.': 3.45703125,
  ' ': 3.375,
};

/**
 * The width in pixels of the widest time axis label, with the Inter widths, so it does not depend on the loaded
 * font. A label with a character that is not in the table, for example of a custom date format, uses
 * `measureText`.
 */
export function measureTimeAxisLabelWidth(labels: string[], fontSize: number): number {
  return labels.reduce((widest, label) => {
    const chars = [...label];
    const width = chars.every((char) => char in INTER_12PX)
      ? (chars.reduce((sum, char) => sum + INTER_12PX[char], 0) * fontSize) / 12
      : measureText(label, fontSize).width;
    return Math.max(widest, width);
  }, 0);
}
