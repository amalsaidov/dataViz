import { fireEvent, render, screen } from '@testing-library/react';
import { ChartZoomControls } from 'lib/components/ChartZoomControls';
import { geoChartModule } from 'lib/echarts/charts/geo';
import { type ChartContext } from 'lib/echarts/charts/types';
import { type EChartsType } from 'lib/echarts/echarts';
import { buildPanelChartOption } from 'lib/echarts/options/panelOption';
import { coordsFrame, geoContext, registerTestBasemap, renderGeo } from 'test/geo';
import { DEFAULT_LAYER_SELECTOR, readCanvasLayer } from 'test/canvas';
import React from 'react';
import { registerGeoChart } from './chart';
import { projectLonLat } from './projection';

// The zoom buttons of the geo panel against core Geomap. One click of the core Zoom control is one OpenLayers zoom
// level. At zoom `z` the world is `256 * 2^z` px wide, and the view center is the panel center.
// https://openlayers.org/en/latest/apidoc/module-ol_control_Zoom-Zoom.html

const width = 800;
const height = 512;
const points: Array<[number, number]> = [
  [46, 14],
  [52.5, 13.4],
  [40.4, -3.7],
];

/** The px position of `[lon, lat]` in an OpenLayers view of the same center, zoom and size. */
function olPixel(lonLat: number[], center: number[], zoom: number): number[] {
  const scale = 256 * 2 ** zoom;
  const [x, y] = projectLonLat(lonLat);
  const [cx, cy] = projectLonLat(center);
  return [width / 2 + (x - cx) * scale, height / 2 + (y - cy) * scale];
}

/** The centers of the drawn circles of the last paint. ECharts draws a unit arc in a scaled transform. */
function readMarkers(dom: HTMLElement): number[][] {
  const all = readCanvasLayer(dom, DEFAULT_LAYER_SELECTOR);
  const events = all.slice(all.map((e) => e.type).lastIndexOf('clearRect'));
  const markers: number[][] = [];
  let at = [0, 0];
  for (const event of events) {
    const props = event.props as Record<string, number>;
    if (event.type === 'setTransform') {
      at = [props.e, props.f];
    } else if (event.type === 'arc') {
      markers.push(at);
    }
  }
  return markers;
}

/** Render the panel option, then click the zoom buttons of `clicks` in order. */
function clickZoom(ctx: ChartContext, clicks: string[]): number[][] {
  const option = buildPanelChartOption(ctx, { isGrafanaLegend: true, plotWidth: width, plotHeight: height });
  const { dom, chart, dispose } = renderGeo(option ?? {}, width, height);
  const chartRef = { current: chart as unknown as EChartsType };
  const { unmount } = render(
    <ChartZoomControls action={geoChartModule.getZoomAction?.(ctx)} chartRef={chartRef} width={width} height={height} />
  );
  clicks.forEach((name) => fireEvent.click(screen.getByRole('button', { name })));
  // Paint the roamed view now, not on the next animation frame.
  chart.getZr().flush();
  const markers = readMarkers(dom);
  unmount();
  dispose();
  return markers;
}

/** Expect the markers at the OpenLayers px positions of the Europe center at `zoom`. */
function expectAtZoom(markers: number[][], zoom: number) {
  expect(markers).toHaveLength(points.length);
  markers.forEach((marker, i) => {
    const [x, y] = olPixel([points[i][1], points[i][0]], [14, 46], zoom);
    expect(marker[0]).toBeCloseTo(x, 6);
    expect(marker[1]).toBeCloseTo(y, 6);
  });
}

describe('Geo zoom buttons render', () => {
  beforeAll(() => {
    registerGeoChart();
    registerTestBasemap();
  });

  const europe = (extra = {}) => geoContext([coordsFrame(points)], { view: { id: 'europe', zoom: 4, ...extra } });

  it('zooms in and out one OpenLayers zoom level about the panel center, as the core Zoom control', () => {
    expectAtZoom(clickZoom(europe(), ['Zoom in']), 5);
    expectAtZoom(clickZoom(europe(), ['Zoom out']), 3);
  });

  it('stops at the view maxZoom and minZoom', () => {
    expectAtZoom(clickZoom(europe({ maxZoom: 4 }), ['Zoom in']), 4);
    expectAtZoom(clickZoom(europe({ minZoom: 4 }), ['Zoom out']), 4);
  });

  it('resets to the start view of the panel options', () => {
    expectAtZoom(clickZoom(europe(), ['Zoom in', 'Zoom in', 'Reset zoom']), 4);
  });
});
