import { DataTopic, FieldType, toDataFrame } from '@grafana/data';
import { type VizAnnotations } from '@grafana/schema';
import { render } from '@testing-library/react';
import { normalizeCanvasEvents, SERIES_ZLEVEL } from 'test/canvas';
import { getCanvasEvents, getComponent, height, width } from 'test/panel';

// Canvas baselines of the core annotation panel options (`options.annotations`) on the cartesian
// panel. The lines and the band draw on the default layer, and the markers on the series layer.
// The claims are in `annotation-options.integration.test.tsx`.

const times = [1783137094497, 1783140694497, 1783144294497, 1783147894497];

const seriesFrame = toDataFrame({
  fields: [
    { name: 'time', type: FieldType.time, values: times },
    { name: 'cpu', type: FieldType.number, values: [10, 20, 30, 10] },
  ],
});

// Two annotation frames, as two dashboard annotation queries give: points, then a region.
const pointFrame = toDataFrame({
  meta: { dataTopic: DataTopic.Annotations },
  fields: [
    { name: 'time', type: FieldType.time, values: [1783139000000] },
    { name: 'color', type: FieldType.string, values: ['red'] },
  ],
});
const regionFrame = toDataFrame({
  meta: { dataTopic: DataTopic.Annotations },
  fields: [
    { name: 'time', type: FieldType.time, values: [1783143000000] },
    { name: 'timeEnd', type: FieldType.time, values: [1783145500000] },
    { name: 'isRegion', type: FieldType.boolean, values: [true] },
    { name: 'color', type: FieldType.string, values: ['rgba(0, 211, 255, 1)'] },
  ],
});

const renderEvents = async (annotations: VizAnnotations) => {
  const { container } = render(
    getComponent(
      [seriesFrame],
      'line',
      { zLevel: { series: SERIES_ZLEVEL }, animation: { enabled: false }, editorMode: 'advanced', annotations },
      { annotations: [pointFrame, regionFrame] }
    )
  );
  return getCanvasEvents(container);
};

describe('cartesian annotation options', () => {
  it('draws 4 px lines and a band at 0.3 opacity', async () => {
    const { defaultEvents, seriesEvents } = await renderEvents({ lines: { width: 4 }, regions: { opacity: 0.3 } });
    expect(normalizeCanvasEvents(defaultEvents)).toMatchCanvasSnapshot(seriesEvents, { width, height });
  });

  it('draws the markers of each frame in its own row, with no lines and no band', async () => {
    const { defaultEvents, seriesEvents } = await renderEvents({ multiLane: true });
    expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
  });
});
