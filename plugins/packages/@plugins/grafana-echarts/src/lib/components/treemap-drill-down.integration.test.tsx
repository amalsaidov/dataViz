import { FieldType, toDataFrame } from '@grafana/data';
import { screen } from '@testing-library/react';
import { type EChartsType } from 'echarts';
import { waitForFinished } from 'test/panel';
import { tileBox } from 'test/treemap';
import { clickAt, dispatch, renderTooltipPanel } from 'test/tooltipPointer';

// Treemap drill down (#813): a click on a parent header makes that node the view root, and a leaf click pins
// the tooltip and does not zoom. Each test compares the render before and after the click.
// https://echarts.apache.org/en/option.html#series-treemap.upperLabel

// total > render > draw, with an io sibling under total.
const nestedSetFrame = toDataFrame({
  fields: [
    { name: 'level', type: FieldType.number, values: [0, 1, 2, 1] },
    { name: 'value', type: FieldType.number, values: [100, 60, 40, 30] },
    { name: 'self', type: FieldType.number, values: [10, 20, 40, 30] },
    { name: 'label', type: FieldType.string, values: ['total', 'render', 'draw', 'io'] },
  ],
});

/** Hover, then click a point through the real zrender handler. */
async function hoverAndClick(chart: EChartsType, x: number, y: number) {
  await dispatch(chart, 'mousemove', x, y);
  await clickAt(chart, x, y);
  await waitForFinished(chart);
}

const renderTreemap = () =>
  renderTooltipPanel({
    frames: [nestedSetFrame],
    seriesType: 'treemap',
    family: 'hierarchy',
    options: { animation: { enabled: false } },
  });

describe('treemap drill down', () => {
  it('zooms to a parent node when its header is clicked', async () => {
    const chart = await renderTreemap();
    const before = tileBox(chart, 'draw')!;
    const header = tileBox(chart, 'render')!;
    expect(tileBox(chart, 'io')).toBeDefined();

    // The header strip is the top 20px of the parent tile.
    await hoverAndClick(chart, header.x + header.width / 2, header.y + 5);

    // The sibling is no longer drawn and the child fills more of the panel.
    expect(tileBox(chart, 'io')).toBeUndefined();
    const after = tileBox(chart, 'draw')!;
    expect(after.width * after.height).toBeGreaterThan(before.width * before.height);
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  });

  it('pins the tooltip and does not zoom when a leaf is clicked', async () => {
    const chart = await renderTreemap();
    const before = tileBox(chart, 'io')!;

    await hoverAndClick(chart, before.x + before.width / 2, before.y + before.height / 2);

    expect(tileBox(chart, 'io')).toEqual(before);
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });
});
