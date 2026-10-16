import { FieldType, toDataFrame } from '@grafana/data';
import { resolveFieldStyleOptions } from 'lib/echarts/converters/fieldOverrides';
import { type PanelOptions } from 'types';

const field = (custom: Record<string, unknown>) =>
  toDataFrame({ fields: [{ name: 'a', type: FieldType.number, values: [1], config: { custom } }] }).fields[0];

const options = {
  lineWidth: 1,
  fillOpacity: 0,
  pointSize: 5,
  performance: { showPoints: 'auto', downsampling: true },
} as PanelOptions;

describe('resolveFieldStyleOptions', () => {
  it('keeps the panel options when the field has no style', () => {
    expect(resolveFieldStyleOptions(field({}), options)).toBe(options);
  });

  it('gives the field values precedence over the panel options', () => {
    expect(
      resolveFieldStyleOptions(field({ lineWidth: 4, fillOpacity: 30, pointSize: 12, showPoints: 'never' }), options)
    ).toEqual({
      lineWidth: 4,
      fillOpacity: 30,
      pointSize: 12,
      performance: { showPoints: 'never', downsampling: true },
    });
  });

  it('ignores a value that is not valid', () => {
    expect(resolveFieldStyleOptions(field({ lineWidth: 'x', showPoints: 'sometimes' }), options)).toBe(options);
  });
});
