import { PanelOptionsEditorBuilder, standardEditorsRegistry } from '@grafana/data';
import { type PanelOptions } from 'types';
import { addGeoControlsOptions } from './controls';

const noEditor = (): null => null;
standardEditorsRegistry.setInit(() => ['boolean', 'radio'].map((id) => ({ id, name: id, editor: noEditor })));

describe('addGeoControlsOptions', () => {
  it('adds the zoom switches and the tooltip radio of the core "Map controls" group', () => {
    const builder = new PanelOptionsEditorBuilder<PanelOptions>();
    addGeoControlsOptions(builder);
    const items = builder.getItems();

    expect(items.map((i) => [i.path, i.defaultValue])).toEqual([
      ['controls.showZoom', true],
      ['controls.mouseWheelZoom', true],
      ['tooltip.mode', 'details'],
    ]);
    expect(items.every((i) => i.category?.[0] === 'Map controls')).toBe(true);
  });
});
