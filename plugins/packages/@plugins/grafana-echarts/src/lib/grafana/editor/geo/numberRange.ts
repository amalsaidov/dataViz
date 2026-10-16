// The range of the numbers of a dimension editor.
import { type ScaleDimensionConfig } from '@grafana/schema';

/** The range of a number dimension editor. */
export interface NumberRange {
  min: number;
  max: number;
}

/** The number of a number input, in the range `min` to `max`. An empty or bad text gives `undefined`. */
export function clampFixed(text: string, min: number, max: number): number | undefined {
  const value = text.trim() === '' ? NaN : Number(text);
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : undefined;
}

/**
 * A scale dimension in the range of the editor, as core `validateScaleConfig`: an unset min or max gets the
 * range limit, a min above the max changes places with it, and each limit and the fixed value stay in the range.
 * Core: https://github.com/grafana/grafana/blob/main/public/app/features/dimensions/scale.ts
 */
export function validateScale(cfg: Partial<ScaleDimensionConfig>, range: NumberRange): ScaleDimensionConfig {
  let min = cfg.min ?? range.min;
  let max = cfg.max ?? range.max;
  if (min > max) {
    [min, max] = [max, min];
  }
  min = Math.max(min, range.min);
  max = Math.min(max, range.max);
  let fixed = cfg.fixed ?? min + (max - min) / 2;
  if (!cfg.field) {
    fixed = Math.min(range.max, Math.max(range.min, fixed));
  }
  return { ...cfg, min, max, fixed };
}
