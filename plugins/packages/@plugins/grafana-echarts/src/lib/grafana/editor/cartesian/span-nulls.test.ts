import { type FieldConfigEditorBuilder } from '@grafana/data';
import { type EChartsGraphFieldConfig } from 'editor/types';
import { addCartesianSpanNullsFieldConfig } from './span-nulls';

type Item = { showIf?: (config: Partial<EChartsGraphFieldConfig>) => boolean };
let item: Item = {};
// A builder that keeps the config of the property.
const builder = {
  addCustomEditor: (config: Item) => {
    item = config;
    return builder;
  },
} as unknown as FieldConfigEditorBuilder<EChartsGraphFieldConfig>;
addCartesianSpanNullsFieldConfig(builder);

describe('addCartesianSpanNullsFieldConfig', () => {
  it('shows Connect null values only for a field that draws as a line', () => {
    for (const seriesType of [undefined, 'Auto', 'line']) {
      expect(item.showIf!({ seriesType } as Partial<EChartsGraphFieldConfig>)).toBe(true);
    }
    for (const seriesType of ['bar', 'scatter', 'effectScatter']) {
      expect(item.showIf!({ seriesType } as Partial<EChartsGraphFieldConfig>)).toBe(false);
    }
  });
});
