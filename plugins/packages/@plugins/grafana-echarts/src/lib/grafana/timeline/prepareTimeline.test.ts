import {
  createTheme,
  dateTime,
  FieldColorModeId,
  FieldType,
  getDisplayProcessor,
  SpecialValueMatch,
  ThresholdsMode,
  type DataFrame,
  type FieldConfig,
  type TimeRange,
  toDataFrame,
} from '@grafana/data';
import { MappingType } from '@grafana/schema';
import { fmtDuration } from './duration';
import { prepareTimeline, type PrepareTimelineOptions, TIMELINE_ISSUE_MESSAGES } from './prepareTimeline';

// Cases ported from core's `TimelineChart/utils.test.ts`, stated on the drawn segments
// rather than on the joined frame.

const theme = createTheme();

const range = (from: number | string, to: number | string): TimeRange => ({
  from: dateTime(from),
  to: dateTime(to),
  raw: { from: dateTime(from), to: dateTime(to) },
});

/** Give every field a display processor, as Grafana does before the panel renders. */
const withDisplay = (frames: DataFrame[]): DataFrame[] => {
  for (const frame of frames) {
    for (const field of frame.fields) {
      field.display = getDisplayProcessor({ field, theme });
    }
  }
  return frames;
};

const opts = (timeRange: TimeRange, mergeValues = true): PrepareTimelineOptions => ({ mergeValues, timeRange, theme });

const spans = (frames: DataFrame[], options: PrepareTimelineOptions) => {
  const { model, issue } = prepareTimeline(withDisplay(frames), options);
  if (issue) {
    throw new Error(issue.message);
  }
  return model.lanes.map((lane) => lane.segments.map(({ start, end, text }) => [start, end, text]));
};

describe('prepareTimeline issues', () => {
  const timeRange = range(1, 3);

  it('errors with no time fields', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'a', values: [1, 2, 3] },
          { name: 'b', values: ['a', 'b', 'c'] },
        ],
      }),
    ];
    expect(prepareTimeline(frames, opts(timeRange)).issue?.reason).toBe('no-time-field');
  });

  it('requires a number, string, or boolean value', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'a', type: FieldType.time, values: [1, 2, 3] },
          { name: 'b', type: FieldType.other, values: [{}, {}, {}] },
        ],
      }),
    ];
    expect(prepareTimeline(frames, opts(timeRange)).issue?.reason).toBe('no-graphable-fields');
  });

  it('gives the fix step when all state values are null', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'a', type: FieldType.time, values: [1, 2] },
          { name: 'b', type: FieldType.string, values: [null, null] },
        ],
      }),
    ];
    expect(prepareTimeline(frames, opts(timeRange)).issue).toEqual({
      reason: 'empty-state-fields',
      message: TIMELINE_ISSUE_MESSAGES['empty-state-fields'],
    });
  });

  it('draws nothing and reports nothing for no frames', () => {
    expect(prepareTimeline([], opts(timeRange))).toEqual({ model: { lanes: [], legendItems: [] } });
  });

  it('reports a null in the time field with the query refId', () => {
    const frames = [
      toDataFrame({
        refId: 'A',
        fields: [
          { name: 'time', type: FieldType.time, values: [1, null, 3] },
          { name: 'state', type: FieldType.string, values: ['a', 'b', 'c'] },
        ],
      }),
    ];
    expect(prepareTimeline(withDisplay(frames), opts(timeRange)).issue).toEqual({
      reason: 'null-time-value',
      message: 'Query A returned a time field with null values; filter out rows with empty timestamps',
    });
  });
});

describe('prepareTimeline segments', () => {
  const timeRange = range(1, 10);

  it('merges equal neighbours, continues over undefined and stops at null', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'a', type: FieldType.time, values: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
          { name: 'b', type: FieldType.number, values: [1, 1, undefined, 1, 2, 2, null, 2, 3] },
        ],
      }),
    ];
    expect(spans(frames, opts(timeRange))).toEqual([
      [
        [1, 5, '1'],
        [5, 7, '2'],
        [8, 9, '2'],
        [9, 10, '3'],
      ],
    ]);
  });

  it('draws one segment per row when mergeValues is off', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'a', type: FieldType.time, values: [1, 2, 3] },
          { name: 'b', type: FieldType.string, values: ['x', 'x', 'y'] },
        ],
      }),
    ];
    expect(spans(frames, opts(timeRange, false))).toEqual([
      [
        [1, 2, 'x'],
        [2, 3, 'x'],
        [3, 10, 'y'],
      ],
    ]);
  });

  it('sorts the time field', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'a', type: FieldType.time, values: [4, 3, 1, 2] },
          { name: 'b', type: FieldType.string, values: ['d', 'c', 'a', 'b'] },
        ],
      }),
    ];
    expect(spans(frames, opts(timeRange))[0].map(([, , text]) => text)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('draws a mapped null as a bar', () => {
    const config: FieldConfig = {
      mappings: [
        { type: MappingType.SpecialValue, options: { match: SpecialValueMatch.Null, result: { text: 'N/A' } } },
      ],
    };
    const frames = [
      toDataFrame({
        fields: [
          { name: 'a', type: FieldType.time, values: [1, 2, 3] },
          { name: 'b', type: FieldType.string, values: ['x', null, 'y'], config },
        ],
      }),
    ];
    expect(spans(frames, opts(timeRange))[0].map(([, , text]) => text)).toEqual(['x', 'N/A', 'y']);
  });

  it('joins frames with NULL_RETAIN: a state continues over rows of other frames', () => {
    const timeRange2 = range('2023-10-20T05:04:00.000Z', '2023-10-20T07:22:00.000Z');
    const frames = [
      toDataFrame({
        name: 'Mix',
        fields: [
          { name: 'time', type: FieldType.time, values: [1697778291972, 1697778393992, 1697778986994, 1697786485890] },
          { name: 'state', type: FieldType.string, values: ['RUN', null, 'RUN', null] },
        ],
      }),
      toDataFrame({
        name: 'Cook',
        fields: [
          { name: 'time', type: FieldType.time, values: [1697779163986, 1697779921045, 1697780221094] },
          { name: 'state', type: FieldType.string, values: ['Heat', 'Stage', null] },
        ],
      }),
    ];
    expect(spans(frames, opts(timeRange2))).toEqual([
      [
        [1697778291972, 1697778393992, 'RUN'],
        // Runs over the three Cook rows (undefined in this lane) up to its own null.
        [1697778986994, 1697786485890, 'RUN'],
      ],
      [
        [1697779163986, 1697779921045, 'Heat'],
        [1697779921045, 1697780221094, 'Stage'],
      ],
    ]);
  });

  it('joins frames with start and end time fields', () => {
    const timeRange2 = range('2024-02-28T07:47:21.428Z', '2024-02-28T14:12:43.391Z');
    const frames = [
      toDataFrame({
        name: 'Channel 1',
        fields: [
          { name: 'starttime', type: FieldType.time, values: [1709107200000, 1709118000000] },
          { name: 'endtime', type: FieldType.time, values: [1709114400000, 1709128800000] },
          { name: 'state', type: FieldType.string, values: ['OK', 'NO_DATA'] },
        ],
      }),
      toDataFrame({
        name: 'Channel 2',
        fields: [
          { name: 'starttime', type: FieldType.time, values: [1709110800000, 1709123400000] },
          { name: 'endtime', type: FieldType.time, values: [1709116200000, 1709127000000] },
          { name: 'state', type: FieldType.string, values: ['ERROR', 'WARNING'] },
        ],
      }),
    ];
    expect(spans(frames, opts(timeRange2))).toEqual([
      [
        [1709107200000, 1709114400000, 'OK'],
        [1709118000000, 1709128800000, 'NO_DATA'],
      ],
      [
        [1709110800000, 1709116200000, 'ERROR'],
        [1709123400000, 1709127000000, 'WARNING'],
      ],
    ]);
  });

  it('merges numbers in threshold colour mode by threshold step', () => {
    const config: FieldConfig = {
      color: { mode: FieldColorModeId.Thresholds },
      thresholds: {
        mode: ThresholdsMode.Absolute,
        steps: [
          { value: -Infinity, color: 'green' },
          { value: 10, color: 'red' },
        ],
      },
    };
    const frames = [
      toDataFrame({
        fields: [
          { name: 'a', type: FieldType.time, values: [1, 2, 3, 4] },
          { name: 'b', type: FieldType.number, values: [1, 2, 11, 12], config },
        ],
      }),
    ];
    expect(spans(frames, opts(timeRange))).toEqual([
      [
        [1, 3, '< 10'],
        [3, 10, '10+'],
      ],
    ]);
  });

  it('names lanes by display name and applies fillOpacity to the value colour', () => {
    const frames = withDisplay([
      toDataFrame({
        fields: [
          { name: 'a', type: FieldType.time, values: [1] },
          {
            name: 'b',
            type: FieldType.string,
            values: ['x'],
            config: {
              displayName: 'Lane B',
              color: { mode: FieldColorModeId.Fixed, fixedColor: '#ff0000' },
              custom: { fillOpacity: 50, lineWidth: 2 },
            },
          },
        ],
      }),
    ]);
    const lane = prepareTimeline(frames, opts(timeRange)).model!.lanes[0];
    expect(lane.name).toBe('Lane B');
    expect(lane.lineWidth).toBe(2);
    expect(lane.segments[0]).toMatchObject({ color: '#ff0000', fillColor: '#ff000080' });
  });
});

describe('prepareTimeline samples mode', () => {
  const timeRange = range(1, 10);
  const samples = (options: Partial<PrepareTimelineOptions> = {}): PrepareTimelineOptions => ({
    ...opts(timeRange),
    mode: 'samples',
    ...options,
  });

  it('draws one cell per sample, never merged, even with mergeValues on', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'a', type: FieldType.time, values: [1, 3, 5, 7] },
          { name: 'b', type: FieldType.string, values: ['x', 'x', 'x', 'y'] },
        ],
      }),
    ];
    // Each cell is a point in time: `start` equals `end`.
    expect(spans(frames, samples({ mergeValues: true }))).toEqual([
      [
        [1, 1, 'x'],
        [3, 3, 'x'],
        [5, 5, 'x'],
        [7, 7, 'y'],
      ],
    ]);
  });

  it('draws no cell for undefined, null or NaN', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'a', type: FieldType.time, values: [1, 2, 3, 4, 5] },
          { name: 'b', type: FieldType.number, values: [1, undefined, null, NaN, 2] },
        ],
      }),
    ];
    expect(spans(frames, samples())).toEqual([
      [
        [1, 1, '1'],
        [5, 5, '2'],
      ],
    ]);
  });

  it('does not merge threshold steps', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'a', type: FieldType.time, values: [1, 2, 3] },
          {
            name: 'b',
            type: FieldType.number,
            values: [5, 6, 20],
            config: {
              color: { mode: FieldColorModeId.Thresholds },
              thresholds: {
                mode: ThresholdsMode.Absolute,
                steps: [
                  { value: -Infinity, color: 'green' },
                  { value: 10, color: 'red' },
                ],
              },
            },
          },
        ],
      }),
    ];
    // The cells show the numbers, not the step labels that the merge writes.
    expect(spans(frames, samples())).toEqual([
      [
        [1, 1, '5'],
        [2, 2, '6'],
        [3, 3, '20'],
      ],
    ]);
  });

  it('gives the first interval of the joined times as sampleInterval', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'a', type: FieldType.time, values: [2, 5, 9] },
          { name: 'b', type: FieldType.string, values: ['x', 'y', 'z'] },
        ],
      }),
    ];
    expect(prepareTimeline(withDisplay(frames), samples()).model?.sampleInterval).toBe(3);
  });

  it('has no sampleInterval in changes mode or with one sample', () => {
    const one = () => [
      toDataFrame({
        fields: [
          { name: 'a', type: FieldType.time, values: [2] },
          { name: 'b', type: FieldType.string, values: ['x'] },
        ],
      }),
    ];
    expect(prepareTimeline(withDisplay(one()), samples()).model?.sampleInterval).toBeUndefined();
    expect(prepareTimeline(withDisplay(one()), opts(timeRange)).model?.sampleInterval).toBeUndefined();
  });

  it('draws no cell with one sample, as core has no interval to size it', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'a', type: FieldType.time, values: [2] },
          { name: 'b', type: FieldType.string, values: ['x'] },
        ],
      }),
    ];
    expect(spans(frames, samples())).toEqual([[]]);
    // The state timeline still draws the one state to the end of the range.
    expect(spans(frames, opts(timeRange))).toEqual([[[2, 10, 'x']]]);
  });
});

describe('prepareTimeline lane names', () => {
  it('numbers lanes with the same display name, as core does', () => {
    const frame = (values: string[]) =>
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2] },
          { name: 'SensorA', type: FieldType.string, values },
        ],
      });
    const other = toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2] },
        { name: 'SensorB', type: FieldType.string, values: ['x', 'y'] },
      ],
    });
    const { model } = prepareTimeline(withDisplay([frame(['a', 'b']), other, frame(['c', 'd'])]), opts(range(1, 10)));
    expect(model!.lanes.map((lane) => lane.name)).toEqual(['SensorA 1', 'SensorB', 'SensorA 2']);
  });
});

describe('prepareTimeline legend', () => {
  const timeRange = range(1, 10);

  it('lists each state with its mapped colour', () => {
    const config: FieldConfig = {
      color: { mode: FieldColorModeId.Fixed, fixedColor: 'blue' },
      mappings: [
        {
          type: MappingType.ValueToText,
          options: { ok: { color: 'green', index: 0 }, bad: { color: 'red', index: 1 } },
        },
      ],
    };
    const frames = withDisplay([
      toDataFrame({
        fields: [
          { name: 'a', type: FieldType.time, values: [1, 2, 3] },
          { name: 'b', type: FieldType.string, values: ['ok', 'bad', 'ok'], config },
        ],
      }),
    ]);
    const items = prepareTimeline(frames, opts(timeRange)).model!.legendItems;
    expect(items.map((item) => item.label)).toEqual(['ok', 'bad']);
  });

  it('lists threshold steps in threshold colour mode', () => {
    const config: FieldConfig = {
      color: { mode: FieldColorModeId.Thresholds },
      thresholds: {
        mode: ThresholdsMode.Absolute,
        steps: [
          { value: -Infinity, color: 'green' },
          { value: 80, color: 'red' },
        ],
      },
    };
    const frames = withDisplay([
      toDataFrame({
        fields: [
          { name: 'a', type: FieldType.time, values: [1, 2] },
          { name: 'b', type: FieldType.number, values: [10, 90], config },
        ],
      }),
    ]);
    expect(prepareTimeline(frames, opts(timeRange)).model!.legendItems.map((item) => item.label)).toEqual([
      '< 80',
      '80+',
    ]);
  });

  it('has no items in a continuous colour mode', () => {
    const frames = withDisplay([
      toDataFrame({
        fields: [
          { name: 'a', type: FieldType.time, values: [1, 2] },
          {
            name: 'b',
            type: FieldType.number,
            values: [10, 90],
            config: { color: { mode: FieldColorModeId.ContinuousGrYlRd } },
          },
        ],
      }),
    ]);
    expect(prepareTimeline(frames, opts(timeRange)).model!.legendItems).toEqual([]);
  });
});

describe('fmtDuration', () => {
  it.each([
    [0, '0'],
    [1500, '1s 500ms'],
    [65_000, '1m 5s'],
    [3_900_000, '1h 5m'],
    [90_000_000, '1d 1h'],
    [8 * 86_400_000, '1w 1d'],
    [-1, ''],
  ])('formats %d ms as %s', (ms, text) => {
    expect(fmtDuration(ms)).toBe(text);
  });
});

describe('Connect null values and Disconnect values', () => {
  const lane = (custom: Record<string, unknown>, times = [0, 10, 20, 30], values: unknown[] = ['a', null, 'b', 'b']) =>
    prepareTimeline(
      withDisplay([
        toDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: times },
            { name: 'state', type: FieldType.string, values, config: { custom } },
          ],
        }),
      ]),
      opts(range(0, 40))
    ).model!.lanes[0].segments.map(({ start, end, text }) => [start, end, text]);

  it('draws a gap for a null by default', () => {
    expect(lane({})).toEqual([
      [0, 10, 'a'],
      [20, 40, 'b'],
    ]);
  });

  it('runs the state over a null with spanNulls always', () => {
    expect(lane({ spanNulls: true })).toEqual([
      [0, 20, 'a'],
      [20, 40, 'b'],
    ]);
  });

  it('runs the state over a null only when the gap is under the spanNulls threshold', () => {
    expect(lane({ spanNulls: 21 })).toEqual([
      [0, 20, 'a'],
      [20, 40, 'b'],
    ]);
    expect(lane({ spanNulls: 20 })).toEqual([
      [0, 10, 'a'],
      [20, 40, 'b'],
    ]);
  });

  // `applyNullInsertThreshold` puts the null at the row before the interval plus the threshold.
  it('inserts a gap after a long interval with insertNulls', () => {
    const times = [0, 10, 30];
    const values = ['a', 'a', 'b'];
    expect(lane({}, times, values)).toEqual([
      [0, 30, 'a'],
      [30, 40, 'b'],
    ]);
    expect(lane({ insertNulls: 15 }, times, values)).toEqual([
      [0, 25, 'a'],
      [30, 40, 'b'],
    ]);
  });
});
