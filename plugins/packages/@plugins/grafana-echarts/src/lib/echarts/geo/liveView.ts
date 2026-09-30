import { type GeoComponentOption } from 'echarts';
import { type EChartBuildOption } from 'lib/echarts/charts/types';
import { type EChartsType } from 'lib/echarts/echarts';

// This file has no runtime imports, so the shared Panel chunk can import it without the geo chunk.

/** The live `center` and `zoom` of the `geo` component, after a zoom or a pan of the user. */
export interface GeoViewState {
  center?: number[];
  zoom?: number;
}

/**
 * The live view of the first `geo` component, or `undefined` for a chart with no `geo` component.
 * https://echarts.apache.org/en/api.html#echartsInstance.getOption
 */
export function readLiveGeoView(chart: Pick<EChartsType, 'getOption'>): GeoViewState | undefined {
  const geo: unknown = chart.getOption()?.geo;
  const first: unknown = Array.isArray(geo) ? geo[0] : undefined;
  if (typeof first !== 'object' || first === null) {
    return undefined;
  }
  const center: unknown = 'center' in first ? first.center : undefined;
  const zoom: unknown = 'zoom' in first ? first.zoom : undefined;
  return {
    center: isPoint(center) ? center : undefined,
    zoom: typeof zoom === 'number' && Number.isFinite(zoom) ? zoom : undefined,
  };
}

const isPoint = (value: unknown): value is number[] =>
  Array.isArray(value) && value.length === 2 && value.every((v) => typeof v === 'number' && Number.isFinite(v));

const isGeoComponent = (value: unknown): value is GeoComponentOption => typeof value === 'object' && value !== null;

/** Write the view into the `geo` component of a new option. */
export function applyGeoView(option: EChartBuildOption, view: GeoViewState): void {
  const raw: unknown = 'geo' in option ? option.geo : undefined;
  const geo: unknown = Array.isArray(raw) ? raw[0] : raw;
  if (!isGeoComponent(geo)) {
    return;
  }
  if (view.center) {
    geo.center = view.center;
  }
  if (view.zoom != null) {
    geo.zoom = view.zoom;
  }
}
