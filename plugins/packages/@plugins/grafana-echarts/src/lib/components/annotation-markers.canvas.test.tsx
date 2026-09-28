import { DataTopic, FieldType, toDataFrame } from '@grafana/data';
import { render } from '@testing-library/react';
import { normalizeCanvasEvents, SERIES_ZLEVEL } from 'test/canvas';
import { getCanvasEvents, getComponent, height, width } from 'test/panel';

// Canvas baseline of the annotation markers under the plot (core `AnnotationMarker`): a
// triangle at a point and a bar under a region. The markers draw on the series layer, so that
// layer is the baseline and the default layer (the grid, the lines and the band) is context.
// The claims are in `annotation-markers.integration.test.tsx`.

const times = [1783137094497, 1783140694497, 1783144294497, 1783147894497];

const seriesFrame = toDataFrame({
  fields: [
    { name: 'time', type: FieldType.time, values: times },
    { name: 'cpu', type: FieldType.number, values: [10, 20, 30, 10] },
  ],
});

const annotationFrame = toDataFrame({
  meta: { dataTopic: DataTopic.Annotations },
  fields: [
    { name: 'time', type: FieldType.time, values: [1783139000000, 1783143000000] },
    { name: 'timeEnd', type: FieldType.time, values: [null, 1783145500000] },
    { name: 'isRegion', type: FieldType.boolean, values: [false, true] },
    { name: 'color', type: FieldType.string, values: ['red', 'rgba(0, 211, 255, 1)'] },
    { name: 'title', type: FieldType.string, values: ['Deploy', 'Maintenance'] },
  ],
});

describe('cartesian annotation markers', () => {
  it('draws a triangle under the plot at a point and a bar under a region', async () => {
    const { container } = render(
      getComponent(
        [seriesFrame],
        'line',
        { zLevel: { series: SERIES_ZLEVEL }, animation: { enabled: false }, editorMode: 'advanced' },
        { annotations: [annotationFrame] }
      )
    );
    const { defaultEvents, seriesEvents } = await getCanvasEvents(container);
    expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
  });
});
