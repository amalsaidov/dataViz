// The y range and the y ticks of a linear axis of the core Time series panel.
// Range: `UPlotScaleBuilder` (soft and hard limits, then `uPlot.rangeNum` with a 10% pad):
// https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/uPlot/config/UPlotScaleBuilder.ts
// Ticks: `calculateSpace` and the tick decimals of `UPlotAxisBuilder`:
// https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/uPlot/config/UPlotAxisBuilder.ts
// `rangeNum` and `findIncr` of uPlot 1.6: https://github.com/leeoniya/uPlot/blob/master/src/utils.js

/** Core uses the small y tick space when the axis is 150 px or shorter (`Y_TICK_SPACING_PANEL_HEIGHT`). */
const Y_TICK_SPACE_SMALL_AXIS = 150;
/** The minimum distance in pixels between two y ticks (`Y_TICK_SPACING_NORMAL`, `Y_TICK_SPACING_SMALL`). */
const Y_TICK_SPACE_NORMAL = 30;
const Y_TICK_SPACE_SMALL = 15;
/** The tick steps of uPlot (`numIncrs`): 1, 2, 2.5 and 5 of each power of 10. */
const INCR_MULTIPLES = [1, 2, 2.5, 5];
/** The pad of uPlot around the data, as a part of the data range. */
const RANGE_PAD = 0.1;

/** The minimum distance in pixels between two y ticks of an axis of `axisLength` px. */
export function getYTickSpace(axisLength: number): number {
  return axisLength <= Y_TICK_SPACE_SMALL_AXIS ? Y_TICK_SPACE_SMALL : Y_TICK_SPACE_NORMAL;
}

/** Removes the float error of a multiple, for example 0.30000000000000004. */
const fixFloat = (value: number) => Math.round(value * 1e12) / 1e12;
const roundDown = (value: number, incr: number) => fixFloat(Math.floor(fixFloat(value / incr)) * incr);
const roundUp = (value: number, incr: number) => fixFloat(Math.ceil(fixFloat(value / incr)) * incr);

/** `uPlot.rangeNum` for one side: soft mode 3 (no soft limit) or 1 (a soft limit), with a hard limit. */
function rangeNum(
  min: number,
  max: number,
  softMin: number | undefined,
  softMax: number | undefined
): [number, number] {
  let delta = max - min;
  const scalarMax = Math.max(Math.abs(min), Math.abs(max));
  if (delta < 1e-24 || Math.abs(Math.log10(scalarMax) - Math.log10(delta)) > 10) {
    delta = min === 0 || max === 0 ? 1e-24 : 0;
  }
  const nonZeroDelta = delta || scalarMax || 1e3;
  const base = 10 ** Math.floor(Math.log10(nonZeroDelta));
  const padOf = (value: number) => nonZeroDelta * (delta === 0 ? (value === 0 ? 0.1 : 1) : RANGE_PAD);

  // With no soft limit, uPlot uses a soft limit of 0 that only applies when the pad crosses 0 (mode 3).
  const newMin = roundDown(min - padOf(min), base / 10);
  const lowSoft = softMin ?? 0;
  const useSoftMin = min >= lowSoft && (softMin != null || newMin <= lowSoft);
  const minLim = useSoftMin ? lowSoft : newMin;

  const newMax = roundUp(max + padOf(max), base / 10);
  const highSoft = softMax ?? 0;
  const useSoftMax = max <= highSoft && (softMax != null || newMax >= highSoft);
  const maxLim = useSoftMax ? highSoft : newMax;

  return minLim === 0 && maxLim === 0 ? [0, 100] : [minLim, maxLim];
}

export interface CoreYRangeInput {
  dataMin: number;
  dataMax: number;
  /** "Axis > Soft min/max". */
  softMin?: number;
  softMax?: number;
  /** "Standard options > Min/Max". */
  hardMin?: number;
  hardMax?: number;
  /** "Standard options > Decimals" 0 rounds the range to integers. */
  decimals?: number;
}

/** The range of a linear y axis of core, from the data extent and the limits. */
export function getCoreYRange({
  dataMin,
  dataMax,
  softMin,
  softMax,
  hardMin,
  hardMax,
  decimals,
}: CoreYRangeInput): [number, number] {
  const hardMinOnly = softMin == null && hardMin != null;
  const hardMaxOnly = softMax == null && hardMax != null;
  let [min, max] = rangeNum(hardMinOnly ? hardMin : dataMin, hardMaxOnly ? hardMax : dataMax, softMin, softMax);
  min = Math.max(min, hardMin ?? -Infinity);
  max = Math.min(max, hardMax ?? Infinity);
  if (decimals === 0) {
    [min, max] = [Math.floor(min), Math.ceil(max)];
  }
  if (hardMinOnly) {
    min = hardMin;
  }
  if (hardMaxOnly) {
    max = hardMax;
  }
  if (min === max && min !== 0) {
    [min, max] = min < 0 ? [min * 2, 0] : [0, max * 2];
  }
  return min >= max ? [0, 100] : [min, max];
}

/** The smallest uPlot tick step that keeps the ticks at least the tick space apart (`findIncr`). */
export function getCoreYTickIncrement(min: number, max: number, axisLength: number): number | undefined {
  const delta = max - min;
  if (!(delta > 0) || !(axisLength > 0)) {
    return undefined;
  }
  const space = getYTickSpace(axisLength);
  for (let exp = Math.floor(Math.log10((space / axisLength) * delta)) - 1; exp < 32; exp++) {
    for (const multiple of INCR_MULTIPLES) {
      // `1e-1` notation, as uPlot, gives an exact step.
      const incr = Number(`${multiple}e${exp}`);
      if ((axisLength * incr) / delta >= space) {
        return incr;
      }
    }
  }
  return undefined;
}

/** The decimals of the tick labels: the decimals of the step, as core (`guessDecimals`), or none. */
export function getYTickDecimals(incr: number): number | undefined {
  const decimals = (String(fixFloat(incr)).split('.')[1] ?? '').length;
  return decimals > 0 ? decimals : undefined;
}

/**
 * The range and the tick values of a linear y axis, as core. The ticks are the multiples of the step in the range
 * (uPlot `numAxisSplits`). ECharts starts its ticks at the axis minimum, so the ticks are custom values. The grid
 * lines follow the `axisTick` values.
 * https://echarts.apache.org/en/option.html#yAxis.axisLabel.customValues
 * https://echarts.apache.org/en/option.html#yAxis.axisTick.customValues
 */
export function getCoreYAxisTicks(
  input: CoreYRangeInput,
  axisLength: number
): { min: number; max: number; ticks?: number[]; decimals?: number } {
  const [min, max] = getCoreYRange(input);
  const incr = getCoreYTickIncrement(min, max, axisLength);
  if (incr == null) {
    return { min, max };
  }
  const ticks: number[] = [];
  for (let tick = roundUp(min, incr); tick <= max; tick = fixFloat(tick + incr)) {
    ticks.push(tick === 0 ? 0 : tick);
  }
  return { min, max, ticks, decimals: getYTickDecimals(incr) };
}

/** The value of an ECharts data item: the last dimension of `[x, value]`, or of `{ value: [x, value] }`. */
function readPoint(item: unknown): [unknown, number] | undefined {
  const point = item != null && typeof item === 'object' && 'value' in item ? item.value : item;
  if (Array.isArray(point) && typeof point[1] === 'number' && Number.isFinite(point[1])) {
    return [point[0], point[1]];
  }
  return undefined;
}

/**
 * The drawn extent of each series. The series of one `stack` add up at each x, the positive and the negative
 * values apart, as the default `stackStrategy` 'samesign' of ECharts.
 * https://echarts.apache.org/en/option.html#series-line.stackStrategy
 */
export function getSeriesExtents(
  series: Array<{ data?: unknown; stack?: string }>
): Array<[number, number] | undefined> {
  const totals = new Map<string, Map<unknown, [number, number]>>();
  return series.map(({ data, stack }) => {
    const stackTotals = stack != null ? (totals.get(stack) ?? new Map<unknown, [number, number]>()) : undefined;
    if (stack != null && stackTotals) {
      totals.set(stack, stackTotals);
    }
    let extent: [number, number] | undefined;
    for (const item of Array.isArray(data) ? data : []) {
      const point = readPoint(item);
      if (!point) {
        continue;
      }
      let [x, value] = point;
      if (stackTotals) {
        const [positive, negative] = stackTotals.get(x) ?? [0, 0];
        value += value >= 0 ? positive : negative;
        stackTotals.set(x, point[1] >= 0 ? [value, negative] : [positive, value]);
      }
      extent = extent ? [Math.min(extent[0], value), Math.max(extent[1], value)] : [value, value];
    }
    return extent;
  });
}
