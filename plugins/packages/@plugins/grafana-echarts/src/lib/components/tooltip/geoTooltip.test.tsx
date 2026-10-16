import { createDataFrame, type DataFrame, FieldType } from '@grafana/data';
import { FrameGeometrySourceMode, type MapLayerOptions } from '@grafana/schema';
import { screen } from '@testing-library/react';
import { type EChartsType } from 'echarts';
import { registerGeoChart } from 'lib/echarts/geo/chart';
import { registerTestBasemap } from 'test/geo';
import { clickAt, dispatch, renderTooltipPanel, tooltipText } from 'test/tooltipPointer';
import { type PanelOptions } from 'types';

// The geo marker tooltip against core Geomap, through the real zrender pointer pipeline and the React overlay.
// Core: https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/utils/tooltip.ts
// and https://github.com/grafana/grafana/blob/main/public/app/features/visualization/data-hover/DataHoverView.tsx

const LINK_TITLE = 'City link';

/** Two cities with a name, a position and a value. The `value` field has a data link. */
function citiesFrame(): DataFrame {
  const frame = createDataFrame({
    fields: [
      { name: 'name', type: FieldType.string, values: ['Berlin', 'Paris'] },
      { name: 'lat', type: FieldType.number, values: [52.52, 48.8566] },
      { name: 'lon', type: FieldType.number, values: [13.405, 2.3522] },
      { name: 'value', type: FieldType.number, values: [90, 70], config: { unit: 'percent' } },
    ],
  });
  const value = frame.fields[3];
  value.config.links = [{ title: LINK_TITLE, url: 'http://example.com' }];
  // `applyFieldOverrides` cannot resolve links in tests (see `test/panel.tsx`), so the field gives them itself.
  value.getLinks = () => [{ title: LINK_TITLE, href: 'http://example.com', target: '_self', origin: value }];
  return frame;
}

const markersLayer = (extra: Partial<MapLayerOptions> = {}): MapLayerOptions => ({
  type: 'markers',
  name: 'Layer 1',
  location: { mode: FrameGeometrySourceMode.Auto },
  ...extra,
});

/** The panel options of a Europe view with one markers layer. */
const geoOptions = (mode: string, layer: Partial<MapLayerOptions> = {}): Partial<PanelOptions> =>
  ({
    view: { id: 'europe', zoom: 4 },
    layers: [markersLayer(layer)],
    tooltip: { mode },
    legend: { showLegend: false },
  }) as unknown as Partial<PanelOptions>;

async function renderGeoPanel(frame: DataFrame, options: Partial<PanelOptions>) {
  const chart = await renderTooltipPanel({ frames: [frame], seriesType: 'map', family: 'geo', options });
  return { chart, berlin: markerPixel(chart, [13.405, 52.52]) };
}

/** The px position of `[lon, lat]` on the geo component. */
function markerPixel(chart: EChartsType, lonLat: [number, number]): [number, number] {
  const [x, y] = chart.convertToPixel({ geoIndex: 0 }, lonLat) as number[];
  return [x, y];
}

describe('Geo marker tooltip', () => {
  beforeAll(() => {
    registerGeoChart();
    registerTestBasemap();
  });

  it('details mode: a hover shows the layer name, then one row for each field of the marker row', async () => {
    const { chart, berlin } = await renderGeoPanel(citiesFrame(), geoOptions('details'));
    await dispatch(chart, 'mousemove', ...berlin);

    // Core `DataHoverTabs` shows the layer name over the rows of `DataHoverView`.
    expect(tooltipText()).toBe('Layer 1nameBerlinlat52.5lon13.4value90%');
  });

  it('details mode: a click pins the tooltip and shows the data links of the fields', async () => {
    const { chart, berlin } = await renderGeoPanel(citiesFrame(), geoOptions('details'));
    await dispatch(chart, 'mousemove', ...berlin);
    expect(screen.queryByText(LINK_TITLE)).toBeNull();

    await clickAt(chart, ...berlin);
    expect(screen.getByText(LINK_TITLE)).toBeInTheDocument();
  });

  it('none mode: a hover shows nothing, and a click opens the tooltip, as core', async () => {
    const { chart, berlin } = await renderGeoPanel(citiesFrame(), geoOptions('none'));
    await dispatch(chart, 'mousemove', ...berlin);
    expect(tooltipText()).toBe('');

    await clickAt(chart, ...berlin);
    expect(tooltipText()).toContain('Berlin');
    expect(screen.getByText(LINK_TITLE)).toBeInTheDocument();
  });

  it('a layer with tooltip false shows no tooltip on hover or click', async () => {
    const { chart, berlin } = await renderGeoPanel(citiesFrame(), geoOptions('details', { tooltip: false }));
    await dispatch(chart, 'mousemove', ...berlin);
    await clickAt(chart, ...berlin);
    expect(tooltipText()).toBe('');
  });

  it('a field with hideFrom.tooltip gives no row', async () => {
    const frame = citiesFrame();
    frame.fields[1].config.custom = { hideFrom: { tooltip: true, viz: false, legend: false } };
    const { chart, berlin } = await renderGeoPanel(frame, geoOptions('details'));
    await dispatch(chart, 'mousemove', ...berlin);

    expect(tooltipText()).toContain('Berlin');
    expect(tooltipText()).not.toContain('52.5');
  });
});
