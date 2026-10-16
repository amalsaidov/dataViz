import { createTheme, DataTopic, FieldType, toDataFrame } from '@grafana/data';
import { DEFAULT_ANNOTATION_COLOR } from '@grafana/ui';
import { countAnnotationLanes, readAnnotationDisplay, readAnnotations } from 'lib/grafana/annotations';

const theme = createTheme();

const frame = (fields: Array<{ name: string; type: FieldType; values: unknown[] }>, name?: string) =>
  toDataFrame({ name, meta: { dataTopic: DataTopic.Annotations }, fields });

describe('readAnnotations', () => {
  it('reads points and regions with their theme colors', () => {
    const annotations = readAnnotations(
      [
        frame([
          { name: 'time', type: FieldType.time, values: [100, 200] },
          { name: 'timeEnd', type: FieldType.time, values: [null, 300] },
          { name: 'isRegion', type: FieldType.boolean, values: [false, true] },
          { name: 'color', type: FieldType.string, values: ['red', '#123456'] },
        ]),
      ],
      theme
    );
    expect(annotations).toEqual([
      { time: 100, color: theme.visualization.getColorByName('red'), lane: 0 },
      { time: 200, timeEnd: 300, color: '#123456', lane: 0 },
    ]);
  });

  it('uses the default annotation color when an event has no color', () => {
    const annotations = readAnnotations([frame([{ name: 'time', type: FieldType.time, values: [100] }])], theme);
    expect(annotations).toEqual([
      { time: 100, color: theme.visualization.getColorByName(DEFAULT_ANNOTATION_COLOR), lane: 0 },
    ]);
  });

  it('reads a timeEnd as a point when isRegion is not true, as core', () => {
    const annotations = readAnnotations(
      [
        frame([
          { name: 'time', type: FieldType.time, values: [100] },
          { name: 'timeEnd', type: FieldType.time, values: [300] },
        ]),
      ],
      theme
    );
    expect(annotations).toEqual([{ time: 100, color: expect.any(String), lane: 0 }]);
  });

  it('skips exemplar and xymark frames, and frames with no time field', () => {
    const time = { name: 'time', type: FieldType.time, values: [100] };
    const annotations = readAnnotations(
      [
        frame([time], 'exemplar'),
        frame([time], 'xymark'),
        frame([{ name: 'time', type: FieldType.number, values: [100] }]),
      ],
      theme
    );
    expect(annotations).toEqual([]);
  });

  it('reads nothing when the panel has no annotations', () => {
    expect(readAnnotations(undefined, theme)).toEqual([]);
  });
});

describe('readAnnotations tooltip content', () => {
  it('reads the title, the text and the string tags of each event', () => {
    const annotations = readAnnotations(
      [
        frame([
          { name: 'time', type: FieldType.time, values: [100, 200] },
          { name: 'title', type: FieldType.string, values: ['Deploy', ''] },
          { name: 'text', type: FieldType.string, values: ['<b>v1.2</b>', null] },
          { name: 'tags', type: FieldType.other, values: [['release', 7, 'api'], []] },
        ]),
      ],
      theme
    );
    expect(annotations).toEqual([
      { time: 100, color: expect.any(String), title: 'Deploy', text: '<b>v1.2</b>', tags: ['release', 'api'], lane: 0 },
      { time: 200, color: expect.any(String), tags: [], lane: 0 },
    ]);
  });
});

describe('annotation lanes', () => {
  const point = (time: number) => frame([{ name: 'time', type: FieldType.time, values: [time] }]);

  it('gives each event the index of its frame in the frames that draw', () => {
    const annotations = readAnnotations([point(100), frame([], 'empty'), point(200)], theme);
    expect(annotations.map(({ lane }) => lane)).toEqual([0, 1]);
  });

  it('counts one lane for each frame that draws, as core `getXAnnotationFrames`', () => {
    const exemplar = frame([{ name: 'time', type: FieldType.time, values: [300] }], 'exemplar');
    expect(countAnnotationLanes([point(100), frame([]), point(200), exemplar])).toBe(2);
    expect(countAnnotationLanes(undefined)).toBe(0);
  });
});

describe('readAnnotationDisplay', () => {
  it('keeps the chart defaults when the panel has no annotation options', () => {
    expect(readAnnotationDisplay(undefined)).toEqual({ multiLane: false });
  });

  it('reads the line width and the band opacity', () => {
    expect(readAnnotationDisplay({ lines: { width: 4 }, regions: { opacity: 0.3 } })).toEqual({
      lineWidth: 4,
      regionOpacity: 0.3,
      multiLane: false,
    });
  });

  it('hides the lines and the bands when the width or the opacity is 0, as core', () => {
    const hidden = { lineWidth: 0, regionOpacity: 0, multiLane: false };
    expect(readAnnotationDisplay({ lines: { width: 0 }, regions: { opacity: 0 } })).toEqual(hidden);
    // Core draws a band only in its line pass, so a width of 0 also hides the bands.
    expect(readAnnotationDisplay({ lines: { width: 0 }, regions: { opacity: 0.5 } })).toEqual(hidden);
    expect(readAnnotationDisplay({ regions: { opacity: 0 } })).toEqual(hidden);
  });

  it('hides the lines and the bands of multi-lane annotations until the panel sets them, as core', () => {
    expect(readAnnotationDisplay({ multiLane: true })).toEqual({ lineWidth: 0, regionOpacity: 0, multiLane: true });
    expect(readAnnotationDisplay({ multiLane: true, lines: { width: 2 }, regions: { opacity: 0.1 } })).toEqual({
      lineWidth: 2,
      regionOpacity: 0.1,
      multiLane: true,
    });
  });
});

describe('readAnnotations data links', () => {
  it('keeps the fields with data links and the row of each event, as core `AnnotationMarker`', () => {
    const annotations = readAnnotations(
      [
        toDataFrame({
          meta: { dataTopic: DataTopic.Annotations },
          fields: [
            { name: 'time', type: FieldType.time, values: [100, 200] },
            {
              name: 'title',
              type: FieldType.string,
              values: ['a', 'b'],
              config: { links: [{ title: 'L', url: 'u' }] },
            },
          ],
        }),
      ],
      theme
    );
    expect(annotations.map(({ links }) => links?.rowIndex)).toEqual([0, 1]);
    expect(annotations[0].links?.fields.map((field) => field.name)).toEqual(['title']);
  });
});
