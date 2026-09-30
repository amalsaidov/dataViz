// The range of the fixed number of a dimension editor.

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
