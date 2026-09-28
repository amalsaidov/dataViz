import { DataTopic, FieldType, toDataFrame } from '@grafana/data';
import { render } from '@testing-library/react';
import { normalizeCanvasEvents, SERIES_ZLEVEL } from 'test/canvas';
import { getCanvasEvents, getComponent, height, width } from 'test/panel';

// Canvas baseline of dashboard annotations on the cartesian time axis: a dashed line for a
// point, and a band with a dashed line at each edge for a region (core AnnotationsPlugin).
// ECharts draws the marks on the default layer (zlevel 0), with the grid, so that layer is the
// baseline and the series layer is context. The claims are in `annotations.integration.test.tsx`.

const times = [1783137094497, 1783140694497, 1783144294497, 1783147894497];

const seriesFrame = toDataFrame({
  fields: [
    { name: 'time', type: FieldType.time, values: times },
    { name: 'cpu', type: FieldType.number, values: [10, 20, 30, 10] },
  ],
});

// The frame shape that Grafana's annotation layer gives the panel (`PanelData.annotations`).
const annotationFrame = toDataFrame({
  meta: { dataTopic: DataTopic.Annotations },
  fields: [
    { name: 'time', type: FieldType.time, values: [1783139000000, 1783143000000] },
    { name: 'timeEnd', type: FieldType.time, values: [null, 1783145500000] },
    { name: 'isRegion', type: FieldType.boolean, values: [false, true] },
    { name: 'color', type: FieldType.string, values: ['red', 'rgba(0, 211, 255, 1)'] },
    { name: 'text', type: FieldType.string, values: ['Deploy', 'Maintenance'] },
  ],
});

describe('cartesian annotations', () => {
  it('draws a point as a dashed line and a region as a band between two dashed lines', async () => {
    const { container } = render(
      getComponent(
        [seriesFrame],
        'line',
        { zLevel: { series: SERIES_ZLEVEL }, animation: { enabled: false }, editorMode: 'advanced' },
        { annotations: [annotationFrame] }
      )
    );
    const { defaultEvents, seriesEvents } = await getCanvasEvents(container);
    expect(normalizeCanvasEvents(defaultEvents)).toMatchCanvasSnapshot(seriesEvents, { width, height });
  });
});
