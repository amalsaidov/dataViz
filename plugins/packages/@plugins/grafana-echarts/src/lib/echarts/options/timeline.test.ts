import { createTheme, FieldType, toDataFrame } from '@grafana/data';
import { VisibilityMode } from '@grafana/schema';
import { type TimelineModel } from 'lib/grafana/timeline/types';
import {
  encodeTimelineData,
  getTimelineItems,
  getTimelineLaneBands,
  getTimelineSeries,
  getTimelineText,
  getTimelineYAxis,
} from './timeline';

const theme = createTheme();
const field = toDataFrame({ fields: [{ name: 'state', type: FieldType.string, values: ['a'] }] }).fields[0];
const segment = (start: number, end: number, text: string) => ({
  start,
  end,
  text,
  color: 'green',
  fillColor: 'green',
  textColor: theme.colors.text.primary,
  rowIndex: 0,
});
const model: TimelineModel = {
  lanes: [
    { name: 'A', field, lineWidth: 0, segments: [segment(0, 10, 'OK'), segment(10, 20, 'ERROR')] },
    { name: 'Lane B', field, lineWidth: 1, segments: [segment(5, 20, 'WARN')] },
  ],
  legendItems: [],
};

describe('getTimelineLaneBands', () => {
  it('lays lanes out as core does: edges touch the grid, gaps share the rest', () => {
    const bands = getTimelineLaneBands(3, 0.9);
    expect(bands[0].top).toBe(0);
    expect(bands[2].bottom).toBeCloseTo(1);
    expect(bands[0].bottom - bands[0].top).toBeCloseTo(0.3);
    expect(bands[1].top - bands[0].bottom).toBeCloseTo(0.05);
  });

  it('fills the full height with one lane', () => {
    expect(getTimelineLaneBands(1, 0.5)).toEqual([{ top: 0, bottom: 1 }]);
  });
});

describe('encodeTimelineData', () => {
  it('encodes [start, end, laneTop, laneBottom] in lane order', () => {
    const bands = getTimelineLaneBands(2, 1);
    expect(encodeTimelineData(getTimelineItems(model), bands)).toEqual([
      [0, 10, 0, 0.5],
      [10, 20, 0, 0.5],
      [5, 20, 0.5, 1],
    ]);
  });

  it('centres a cell of cellWidth on each sample time (status history)', () => {
    const samples: TimelineModel = {
      lanes: [{ name: 'A', field, lineWidth: 1, segments: [segment(10, 10, 'OK'), segment(20, 20, 'ERROR')] }],
      legendItems: [],
      sampleInterval: 10,
    };
    expect(encodeTimelineData(getTimelineItems(samples), getTimelineLaneBands(1, 0.9), 9)).toEqual([
      [5.5, 14.5, 0, 1],
      [15.5, 24.5, 0, 1],
    ]);
  });
});

describe('getTimelineYAxis', () => {
  it('labels each lane centre with the lane name, and other ticks with the widest name', () => {
    const axis = getTimelineYAxis(model, getTimelineLaneBands(2, 1));
    expect(axis).toMatchObject({ type: 'value', min: 0, max: 1, inverse: true });
    const label = axis.axisLabel as { customValues: number[]; formatter: (value: number) => string };
    expect(label.customValues).toEqual([0.25, 0.75]);
    expect(label.customValues.map(label.formatter)).toEqual(['A', 'Lane B']);
    expect(label.formatter(0.5)).toBe('Lane B');
  });
});

describe('getTimelineText', () => {
  const grid = { x: 100, y: 0, width: 300, height: 100 };
  const opts = { showValue: VisibilityMode.Auto, alignValue: 'left' as const, font: '12px sans-serif' };

  it('cuts the text to the characters that fit, with no ellipsis', () => {
    expect(getTimelineText('ERROR', { x: 120, y: 0, width: 30, height: 10 }, grid, 0, opts, 10)?.text).toBe('ERR');
  });

  it('hides text under 2 characters in Auto, but not in Always', () => {
    const box = { x: 120, y: 0, width: 15, height: 10 };
    expect(getTimelineText('ERROR', box, grid, 0, opts, 10)).toBeUndefined();
    expect(getTimelineText('ERROR', box, grid, 0, { ...opts, showValue: VisibilityMode.Always }, 10)?.text).toBe('E');
  });

  it('sticks left text to the visible grid edge, and counts only the visible width', () => {
    const cut = { x: 50, y: 0, width: 100, height: 10 };
    expect(getTimelineText('ERROR', cut, grid, 1, opts, 10)).toEqual({ text: 'ERROR', x: 103 });
  });

  it('places center and right text on the full bar', () => {
    const box = { x: 120, y: 0, width: 100, height: 10 };
    expect(getTimelineText('OK', box, grid, 0, { ...opts, alignValue: 'center' }, 10)?.x).toBe(170);
    expect(getTimelineText('OK', box, grid, 1, { ...opts, alignValue: 'right' }, 10)?.x).toBe(217);
  });

  it('draws no text with Never', () => {
    const box = { x: 120, y: 0, width: 100, height: 10 };
    expect(getTimelineText('OK', box, grid, 0, { ...opts, showValue: VisibilityMode.Never }, 10)).toBeUndefined();
  });
});

describe('getTimelineSeries', () => {
  it('is one clipped custom series on the cartesian grid with its own tooltip', () => {
    const series = getTimelineSeries(
      model,
      getTimelineLaneBands(2, 0.9),
      { showValue: VisibilityMode.Auto, alignValue: 'left', font: '12px sans-serif' },
      { timeZone: 'utc' },
      3
    );
    expect(series).toMatchObject({ type: 'custom', coordinateSystem: 'cartesian2d', clip: true, zlevel: 3 });
    expect(series.encode).toEqual({ x: [0, 1], y: [2, 3] });
    expect(typeof series.tooltip?.formatter).toBe('function');
  });
});
