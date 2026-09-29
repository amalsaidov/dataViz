import { CanvasRenderer } from 'echarts/renderers';
import { getMap, init, registerMap, use as registerEChartsModules } from 'echarts/core';
import { DEFAULT_LAYER_SELECTOR, normalizeCanvasEvents, readCanvasLayer } from 'test/canvas';
import { BASEMAP_NAME, registerBasemap } from './basemap';
import { projectLonLat, WORLD_BOUNDING_COORDS, WORLD_LAYOUT, webMercator } from './projection';

// The baseline of the decoded TopoJSON basemap: the Benelux features in Web Mercator at a high zoom. ECharts draws
// each feature of a map at each zoom, so the test registers only these features. This keeps the baseline small.
// `basemap.integration.test.ts` compares each feature with the raw GeoJSON.
// https://echarts.apache.org/en/option.html#geo
const width = 256;
const height = 256;
const REGION_MAP = 'basemap-test-benelux';
const REGION_IDS = ['BEL', 'LUX', 'NLD'];

// The GeoJSON input of `registerMap`. https://echarts.apache.org/en/api.html#echarts.registerMap
type MapSource = Parameters<typeof registerMap>[1];

/** Register the decoded basemap features of `REGION_IDS` as `REGION_MAP`. */
function registerRegion(): void {
  registerBasemap();
  const { geoJSON } = getMap(BASEMAP_NAME) as { geoJSON: { features: Array<{ id?: string }> } };
  const features = geoJSON.features.filter((f) => REGION_IDS.includes(f.id ?? ''));
  registerMap(REGION_MAP, { type: 'FeatureCollection', features } as MapSource);
}

describe('Basemap canvas renders', () => {
  it('benelux', () => {
    registerEChartsModules([CanvasRenderer]);
    registerRegion();
    const dom = document.createElement('div');
    document.body.appendChild(dom);
    const chart = init(dom, undefined, { renderer: 'canvas', width, height });
    chart.setOption({
      animation: false,
      geo: {
        map: REGION_MAP,
        projection: webMercator,
        boundingCoords: WORLD_BOUNDING_COORDS,
        ...WORLD_LAYOUT,
        center: projectLonLat([5.3, 51]),
        zoom: 50,
        silent: true,
      },
    });
    const events = readCanvasLayer(dom, DEFAULT_LAYER_SELECTOR);
    chart.dispose();
    dom.remove();

    expect(normalizeCanvasEvents(events)).toMatchCanvasSnapshot([], { width, height });
  });
});
