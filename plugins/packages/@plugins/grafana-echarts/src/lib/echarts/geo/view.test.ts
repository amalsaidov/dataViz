import { init } from 'lib/echarts/echarts';
import { resolveCoreMapView } from 'lib/grafana/geo/view';
import { BASEMAP_NAME, registerBasemap } from './basemap';
import { projectLonLat, WORLD_BOUNDING_COORDS, webMercator } from './projection';
import { fromGeoZoom, toGeoView, toGeoZoom, toLiveMapView } from './view';

const size = { width: 800, height: 512 };

describe('toGeoZoom', () => {
  it('is 1 when the OpenLayers world width is the short side of the panel', () => {
    // OpenLayers zoom 1: 512 px world, and the panel is 512 px high.
    expect(toGeoZoom(1, size)).toBe(1);
    expect(toGeoZoom(4, size)).toBe(8);
    expect(toGeoZoom(0, { width: 256, height: 1000 })).toBe(1);
  });
});

describe('fromGeoZoom', () => {
  it('is the inverse of toGeoZoom', () => {
    expect(fromGeoZoom(toGeoZoom(4.25, size), size)).toBeCloseTo(4.25, 10);
    expect(fromGeoZoom(1, size)).toBe(1);
  });
});

describe('toLiveMapView', () => {
  it('gives the center in degrees and the OpenLayers zoom, rounded as core', () => {
    const center = projectLonLat([14.1234567, 46.7654321]);
    expect(toLiveMapView({ center, zoom: toGeoZoom(4.567, size) }, size)).toEqual({
      lon: 14.123457,
      lat: 46.765432,
      zoom: 4.57,
    });
  });

  it('gives no view without a center, a zoom or a size', () => {
    expect(toLiveMapView(undefined, size)).toBeUndefined();
    expect(toLiveMapView({ zoom: 1 }, size)).toBeUndefined();
    expect(toLiveMapView({ center: [0, 0] }, size)).toBeUndefined();
    expect(toLiveMapView({ center: [0, 0], zoom: 1 }, { width: 0, height: 0 })).toBeUndefined();
  });
});

describe('toGeoView', () => {
  it('gives the projected center and geo.zoom of a preset', () => {
    const view = toGeoView(resolveCoreMapView({ id: 'europe', zoom: 4 }), size);
    expect(view).toMatchObject({ center: projectLonLat([14, 46]), zoom: 8 });
  });

  it('shows the full world for "Fit to data" with no points', () => {
    expect(toGeoView(resolveCoreMapView({ id: 'fit', zoom: 15 }), size, [])).toMatchObject({
      center: projectLonLat([0, 0]),
      zoom: 1,
    });
  });

  it('fits the extent of the points with the padding', () => {
    const points: Array<[number, number]> = [
      [-10, 0],
      [10, 0],
    ];
    const view = toGeoView(resolveCoreMapView({ id: 'fit', zoom: 15, padding: 0 }), size, points);
    // 20 degrees of longitude over 800 px: the world (360 degrees) is 14400 px wide.
    expect(view.center).toEqual(projectLonLat([0, 0]));
    expect(view.zoom).toBeCloseTo(14400 / 512, 9);
    const padded = toGeoView(resolveCoreMapView({ id: 'fit', zoom: 15, padding: 100 }), size, points);
    expect(padded.zoom).toBeCloseTo(7200 / 512, 9);
  });

  it('stops a fit at the fit maxZoom, also for one point', () => {
    const view = toGeoView(resolveCoreMapView({ id: 'fit', zoom: 5 }), size, [[2.35, 48.85]]);
    expect(view).toMatchObject({ center: projectLonLat([2.35, 48.85]), zoom: toGeoZoom(5, size) });
  });

  it('ignores points that are not finite', () => {
    const view = toGeoView(resolveCoreMapView({ id: 'fit', zoom: 5 }), size, [[NaN, 1]]);
    expect(view.zoom).toBe(toGeoZoom(1, size));
  });
});

describe('toGeoView in ECharts', () => {
  // Place [lon, lat] with the real geo layout. https://echarts.apache.org/en/api.html#echartsInstance.convertToPixel
  const pixelsPerDegree = (olZoom: number) => {
    registerBasemap();
    const chart = init(document.createElement('div'), undefined, size);
    const view = toGeoView(resolveCoreMapView({ id: 'zero', zoom: olZoom }), size);
    chart.setOption({
      geo: { map: BASEMAP_NAME, projection: webMercator, boundingCoords: WORLD_BOUNDING_COORDS, ...view },
    });
    const [x0] = chart.convertToPixel({ geoIndex: 0 }, [0, 0]) as number[];
    const [x1] = chart.convertToPixel({ geoIndex: 0 }, [1, 0]) as number[];
    chart.dispose();
    return x1 - x0;
  };

  it('draws the world as wide as OpenLayers at the same zoom', () => {
    // OpenLayers: the world is 256 * 2^z px wide, over 360 degrees.
    expect(pixelsPerDegree(1)).toBeCloseTo(512 / 360, 6);
    expect(pixelsPerDegree(4)).toBeCloseTo(4096 / 360, 6);
  });
});
