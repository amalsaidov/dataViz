import { createTheme, DataTopic, FieldType, toDataFrame } from '@grafana/data';
import { DEFAULT_ANNOTATION_COLOR } from '@grafana/ui';
import { readAnnotations } from 'lib/grafana/annotations';

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
      { time: 100, color: theme.visualization.getColorByName('red') },
      { time: 200, timeEnd: 300, color: '#123456' },
    ]);
  });

  it('uses the default annotation color when an event has no color', () => {
    const annotations = readAnnotations([frame([{ name: 'time', type: FieldType.time, values: [100] }])], theme);
    expect(annotations).toEqual([{ time: 100, color: theme.visualization.getColorByName(DEFAULT_ANNOTATION_COLOR) }]);
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
    expect(annotations).toEqual([{ time: 100, color: expect.any(String) }]);
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
