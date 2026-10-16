import { createDataFrame, createTheme, FieldType } from '@grafana/data';
import { getMarkerTooltipRows } from './tooltip';

const theme = createTheme();

describe('getMarkerTooltipRows', () => {
  const frame = createDataFrame({
    fields: [
      { name: 'name', type: FieldType.string, values: ['Berlin', 'Paris'] },
      { name: 'value', type: FieldType.number, values: [90, 70], config: { unit: 'percent', displayName: 'Load' } },
      { name: 'secret', type: FieldType.number, values: [1, 2], config: { custom: { hideFrom: { tooltip: true } } } },
    ],
  });

  it('gives the display name and the display text of each field at the row, as core DataHoverView', () => {
    expect(getMarkerTooltipRows(frame, 1, theme).map(({ label, value }) => ({ label, value }))).toEqual([
      { label: 'name', value: 'Paris' },
      { label: 'Load', value: '70%' },
    ]);
  });

  it('gives the field and the row as the source of each row, for the data links', () => {
    const rows = getMarkerTooltipRows(frame, 1, theme);
    expect(rows.map((row) => row.source)).toEqual([
      { field: frame.fields[0], rowIndex: 1 },
      { field: frame.fields[1], rowIndex: 1 },
    ]);
  });
});
