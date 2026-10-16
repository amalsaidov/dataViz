import { type DataFrame, FieldType, toDataFrame } from '@grafana/data';
import { VizOrientation } from '@grafana/schema';
import { render } from '@testing-library/react';
import { AXIS_ZLEVEL, SERIES_ZLEVEL } from 'test/canvas';
import { getAxisCanvasEvents, getComponent } from 'test/panel';
import { type PanelOptions } from 'types';

// Regression #1014: at a narrow width, the x labels of category bars and of the histogram do not overlap,
// as core drops labels that do not fit. "X tick rotation" still rotates the labels.
// The baselines are in `x-tick-overlap.canvas.test.tsx`.

const NARROW = 200;
const WIDE = 1200;

const hosts = (): DataFrame =>
  toDataFrame({
    fields: [
      { name: 'host', type: FieldType.string, values: Array.from({ length: 12 }, (_, i) => `server-${i + 1}.example`) },
      { name: 'value', type: FieldType.number, values: Array.from({ length: 12 }, (_, i) => i + 1) },
    ],
  });

const requests = (): DataFrame =>
  toDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: Array.from({ length: 40 }, (_, i) => i * 60_000) },
      {
        name: 'Requests',
        type: FieldType.number,
        values: Array.from({ length: 40 }, (_, i) => 100000 + i * 250),
        config: { unit: 'suffix: requests' },
      },
    ],
  });

interface XLabel {
  text: string;
  left: number;
  right: number;
  rotated: boolean;
}

/** The x labels drawn under the plot, with their horizontal extent. */
const drawXLabels = async (frame: DataFrame, width: number, match: RegExp, options: Partial<PanelOptions>) => {
  const { container } = render(
    getComponent(
      [frame],
      'bar',
      {
        zLevel: { series: SERIES_ZLEVEL, axis: AXIS_ZLEVEL },
        animation: { enabled: false },
        editorMode: 'advanced',
        ...options,
      },
      undefined,
      { width }
    )
  );
  const { axisEvents, defaultEvents } = await getAxisCanvasEvents(container);
  const ctx = document.createElement('canvas').getContext('2d')!;
  ctx.font = '12px sans-serif';
  const labels: XLabel[] = [];
  let transform: Record<string, number> = {};
  for (const event of [...axisEvents, ...defaultEvents]) {
    if (event.type === 'setTransform') {
      transform = event.props;
    } else if (event.type === 'fillText' && match.test(String(event.props.text))) {
      const text = String(event.props.text);
      const half = ctx.measureText(text).width / 2;
      labels.push({ text, left: transform.e - half, right: transform.e + half, rotated: Math.abs(transform.b) > 0.01 });
    }
  }
  return labels;
};

const overlaps = (labels: XLabel[]) => {
  const sorted = [...labels].sort((a, b) => a.left - b.left);
  return sorted.some((label, i) => i > 0 && label.left < sorted[i - 1].right);
};

describe('x labels at a narrow width (#1014)', () => {
  it.each([
    [
      'category bars with a minimum label spacing',
      hosts,
      /^server-/,
      { orientation: VizOrientation.Vertical, xTickLabelSpacing: 10 },
    ],
    ['histogram', requests, /requests$/, { histogram: true }],
  ] as const)('%s draw no overlapping labels, and fewer than at a wide width', async (_, frame, match, options) => {
    const narrow = await drawXLabels(frame(), NARROW, match, options);
    const wide = await drawXLabels(frame(), WIDE, match, options);

    expect(narrow.length).toBeGreaterThan(1);
    expect(overlaps(narrow)).toBe(false);
    expect(narrow.length).toBeLessThan(wide.length);
  });

  it('keeps "X tick rotation" on category bars', async () => {
    const labels = await drawXLabels(hosts(), NARROW, /^server-/, {
      orientation: VizOrientation.Vertical,
      xTickRotate: -45,
    });

    expect(labels.length).toBeGreaterThan(1);
    expect(labels.every((label) => label.rotated)).toBe(true);
  });
});
