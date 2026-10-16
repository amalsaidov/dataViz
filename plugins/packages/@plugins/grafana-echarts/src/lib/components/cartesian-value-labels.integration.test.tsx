import { type DataFrame, FieldType, formattedValueToString, getDisplayProcessor, toDataFrame } from '@grafana/data';
import { render } from '@testing-library/react';
import { SERIES_ZLEVEL } from 'test/canvas';
import { getCanvasEvents, getComponent, theme } from 'test/panel';

// "Show values" labels on stacked bars draw the text that core Bar chart draws: each
// field's display processor output (unit, decimals), not the raw number. Core formats
// each label with `formattedValueToString(field.display(value))`
// (public/app/plugins/panel/barchart/utils.ts `formatValue`). No baseline here: the
// drawn geometry is pinned in `categorical-cartesian.canvas.test.tsx`.
//
// `editorMode: 'advanced'` is required — in Default mode
// `applyCartesianEditorModeDefaults` resets `animation.enabled` back on and the draw
// calls stop being deterministic.

const UNIT_CONFIG = { unit: 'percent', decimals: 1, custom: { stackSeries: true } };

const Q1 = [20, 14.25, 25];
const Q2 = [23, 10, 30.5];

/** The text core draws for each value: the field's display processor output. */
const coreTexts = (values: number[]) => {
  const display = getDisplayProcessor({ field: { type: FieldType.number, config: UNIT_CONFIG }, theme });
  return values.map((value) => formattedValueToString(display(value)));
};

const categoryFrame = (): DataFrame =>
  toDataFrame({
    fields: [
      { name: 'category', type: FieldType.string, values: ['a', 'b', 'c'] },
      { name: 'Q1', type: FieldType.number, values: Q1, config: UNIT_CONFIG },
      { name: 'Q2', type: FieldType.number, values: Q2, config: UNIT_CONFIG },
    ],
  });

const timeFrame = (): DataFrame =>
  toDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: [1783137094497, 1783140694497, 1783144294497] },
      { name: 'Q1', type: FieldType.number, values: Q1, config: UNIT_CONFIG },
      { name: 'Q2', type: FieldType.number, values: Q2, config: UNIT_CONFIG },
    ],
  });

const labelTexts = async (frame: DataFrame) => {
  const { container } = render(
    getComponent([frame], 'bar', {
      zLevel: { series: SERIES_ZLEVEL },
      animation: { enabled: false },
      editorMode: 'advanced',
      showValues: 'always',
    })
  );
  const { seriesEvents } = await getCanvasEvents(container);
  return seriesEvents.filter((event) => event.type === 'fillText').map((event) => String(event.props.text));
};

describe('cartesian stacked bar value labels', () => {
  const expected = [...coreTexts(Q1), ...coreTexts(Q2)].sort();

  it('formats each segment label with its field unit on a category x-axis', async () => {
    expect(expected).toContain('14.3%');
    expect((await labelTexts(categoryFrame())).sort()).toEqual(expected);
  });

  it('formats each segment label with its field unit on a time x-axis', async () => {
    expect((await labelTexts(timeFrame())).sort()).toEqual(expected);
  });
});
