import { geoChartModule } from 'lib/echarts/charts/geo';
import { type ChartContext } from 'lib/echarts/charts/types';
import { buildPanelChartOption } from 'lib/echarts/options/panelOption';
import { coordsFrame, geoContext, registerTestBasemap, renderGeo } from 'test/geo';
import { DEFAULT_LAYER_SELECTOR, readCanvasLayer } from 'test/canvas';
import { registerGeoChart } from './chart';
import { projectLonLat } from './projection';

// The drawn markers of the geo panel against core Geomap. Core draws with OpenLayers: at zoom `z` the world is
// `256 * 2^z` px wide, and the view center is the panel center.
// https://openlayers.org/en/latest/apidoc/module-ol_View-View.html
// Core markers: https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/style/markers.ts

interface DrawnMarker {
  x: number;
  y: number;
  radius: number;
  fill: string;
  stroke: string;
  alpha: number;
}

/** The px position of `[lon, lat]` in an OpenLayers view of the same center, zoom and size. */
function olPixel(lonLat: number[], center: number[], zoom: number, width: number, height: number): number[] {
  const scale = 256 * 2 ** zoom;
  const [x, y] = projectLonLat(lonLat);
  const [cx, cy] = projectLonLat(center);
  return [width / 2 + (x - cx) * scale, height / 2 + (y - cy) * scale];
}

/** Build and render the panel option, then read each drawn circle. ECharts draws a unit arc in a scaled transform. */
function drawMarkers(ctx: ChartContext, width: number, height: number, resize?: { width: number; height: number }) {
  // The full panel option, as the panel renders it.
  const option = buildPanelChartOption(ctx, { isGrafanaLegend: true, plotWidth: width, plotHeight: height });
  const { dom, chart, dispose } = renderGeo(option ?? {}, width, height);
  if (resize) {
    chart.resize(resize);
    const settled = geoChartModule.getSettledResizeOption?.(ctx, {
      plotWidth: resize.width,
      plotHeight: resize.height,
    });
    chart.setOption(settled ?? {});
  }
  // Each paint starts with a `clearRect`; read the last paint only.
  const all = readCanvasLayer(dom, DEFAULT_LAYER_SELECTOR);
  const events = all.slice(all.map((e) => e.type).lastIndexOf('clearRect'));
  dispose();
  const markers: DrawnMarker[] = [];
  let transform = { a: 1, e: 0, f: 0 };
  let fill = '';
  let stroke = '';
  let alpha = 1;
  for (const event of events) {
    const props = event.props as Record<string, number & string>;
    if (event.type === 'setTransform') {
      transform = { a: props.a, e: props.e, f: props.f };
    } else if (event.type === 'fillStyle') {
      fill = props.value;
    } else if (event.type === 'strokeStyle') {
      stroke = props.value;
    } else if (event.type === 'globalAlpha') {
      alpha = props.value;
    } else if (event.type === 'arc') {
      markers.push({ x: transform.e, y: transform.f, radius: transform.a * props.radius, fill, stroke, alpha });
    }
  }
  return markers;
}

describe('Geo markers render', () => {
  beforeAll(() => {
    registerGeoChart();
    registerTestBasemap();
  });

  const width = 800;
  const height = 512;
  const europe = { view: { id: 'europe', zoom: 4 } };
  const points: Array<[number, number]> = [
    [46, 14],
    [52.5, 13.4],
    [40.4, -3.7],
  ];

  it('draws one marker for each row with a position, at the OpenLayers px position', () => {
    // A null row and a second row at the same position give no marker, as in core.
    const frame = coordsFrame([...points, [null, 1], points[0]]);
    const markers = drawMarkers(geoContext([frame], europe), width, height);

    expect(markers).toHaveLength(points.length);
    markers.forEach((marker, i) => {
      const [x, y] = olPixel([points[i][1], points[i][0]], [14, 46], 4, width, height);
      expect(marker.x).toBeCloseTo(x, 6);
      expect(marker.y).toBeCloseTo(y, 6);
    });
  });

  it('draws the core default style: radius 5, dark-green fill at 0.4, full stroke', () => {
    const [marker] = drawMarkers(geoContext([coordsFrame(points)], europe), width, height);

    expect(marker).toMatchObject({ radius: 5, fill: 'rgba(55, 135, 45, 0.4)', stroke: '#37872d', alpha: 1 });
  });

  it('fits the markers in the panel for the "Fit to data" view', () => {
    const markers = drawMarkers(geoContext([coordsFrame(points)], { view: { id: 'fit' } }), width, height);

    expect(markers).toHaveLength(points.length);
    const xs = markers.map((m) => m.x);
    const ys = markers.map((m) => m.y);
    // The extent fills the panel less the 5% padding on the side that limits the fit.
    const fill = Math.max((Math.max(...xs) - Math.min(...xs)) / width, (Math.max(...ys) - Math.min(...ys)) / height);
    expect(fill).toBeCloseTo(1 / 1.05, 6);
    expect((Math.max(...xs) + Math.min(...xs)) / 2).toBeCloseTo(width / 2, 6);
    expect((Math.max(...ys) + Math.min(...ys)) / 2).toBeCloseTo(height / 2, 6);
  });

  it('keeps the px per degree of the core zoom after a resize, as OpenLayers does', () => {
    const ctx = geoContext([coordsFrame(points)], europe);
    const small = { width: 400, height: 300 };
    const markers = drawMarkers(ctx, width, height, small);

    markers.forEach((marker, i) => {
      const [x, y] = olPixel([points[i][1], points[i][0]], [14, 46], 4, small.width, small.height);
      expect(marker.x).toBeCloseTo(x, 6);
      expect(marker.y).toBeCloseTo(y, 6);
    });
  });

  it('draws the markers of the location of the markers layer', () => {
    const ctx = geoContext([coordsFrame(points)], {
      ...europe,
      layers: [{ type: 'markers', name: 'Layer 1', location: { mode: 'geohash', geohash: 'none' } }],
    } as Partial<ChartContext['options']>);

    // The frame has no `none` geohash field: core draws no marker.
    expect(drawMarkers(ctx, width, height)).toHaveLength(0);
  });
});
