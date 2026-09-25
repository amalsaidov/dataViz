/**
 * Format a duration in milliseconds as core's timeline tooltip does (`1h 5m`, `2d 3h`).
 * A month is 30 days and a year is 365 days. Port of core's `fmtDuration`:
 * https://github.com/grafana/grafana/blob/main/public/app/core/components/TimelineChart/utils.ts
 */
export function fmtDuration(milliSeconds: number): string {
  if (milliSeconds < 0 || Number.isNaN(milliSeconds)) {
    return '';
  }

  let s = Math.floor(milliSeconds / 1000);
  let m = Math.floor(s / 60);
  s = s % 60;
  let h = Math.floor(m / 60);
  m = m % 60;
  let d = Math.floor(h / 24);
  h = h % 24;

  const yr = Math.floor(d / 365);
  if (yr > 0) {
    d = d % 365;
  }
  const mo = Math.floor(d / 30);
  if (mo > 0) {
    d = d % 30;
  }
  const wk = Math.floor(d / 7);
  if (wk > 0) {
    d = d % 7;
  }
  const ms = Math.round((milliSeconds % 1000) * 1000) / 1000;

  // Show the largest unit and the units under it that are not zero, as core does.
  const part = (value: number, unit: string) => (value > 0 ? `${value}${unit} ` : '');
  let text: string;
  if (yr > 0) {
    text = part(yr, 'y') + part(mo, 'mo') + part(wk, 'w') + part(d, 'd');
  } else if (mo > 0) {
    text = part(mo, 'mo') + part(wk, 'w') + part(d, 'd');
  } else if (wk > 0) {
    text = part(wk, 'w') + part(d, 'd');
  } else if (d > 0) {
    text = part(d, 'd') + part(h, 'h');
  } else if (h > 0) {
    text = part(h, 'h') + part(m, 'm');
  } else if (m > 0) {
    text = part(m, 'm') + part(s, 's');
  } else if (s > 0) {
    text = part(s, 's') + part(ms, 'ms');
  } else {
    text = ms > 0 ? part(ms, 'ms') : '0';
  }
  return text.trim();
}
