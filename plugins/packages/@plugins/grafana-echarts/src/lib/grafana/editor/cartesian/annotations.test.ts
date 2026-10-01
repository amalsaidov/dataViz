import {
  type DataFrame,
  DataTopic,
  FieldType,
  PanelOptionsEditorBuilder,
  standardEditorsRegistry,
  toDataFrame,
} from '@grafana/data';
import { addCartesianAnnotationOptions } from 'lib/grafana/editor/cartesian/annotations';
import { type PanelOptions } from 'types';

// Grafana core fills the standard editors registry. Under jest it is empty.
const noEditor = (): null => null;
standardEditorsRegistry.setInit(() => [{ id: 'boolean', name: 'boolean', editor: noEditor }]);

const items = () => {
  const builder = new PanelOptionsEditorBuilder<PanelOptions>();
  addCartesianAnnotationOptions(builder);
  return builder.getItems();
};

const annotationFrame = (length: number): DataFrame =>
  toDataFrame({
    meta: { dataTopic: DataTopic.Annotations },
    fields: [{ name: 'time', type: FieldType.time, values: Array.from({ length }, (_, i) => i) }],
  });

const shown = (path: string, annotations: DataFrame[] | undefined) => {
  const item = items().find((entry) => entry.path === path);
  return item?.showIf?.({} as PanelOptions, [], annotations) ?? true;
};

describe('addCartesianAnnotationOptions', () => {
  it('registers the core paths in the Annotations category', () => {
    expect(items().map(({ path, name, category }) => ({ path, name, category }))).toEqual([
      { path: 'annotations.multiLane', name: 'Enable multi-row annotations', category: ['Annotations'] },
      { path: 'annotations', name: 'Hide lines and areas', category: ['Annotations'] },
    ]);
  });

  it('shows "Enable multi-row annotations" only for two or more annotation frames with events, as core', () => {
    expect(shown('annotations.multiLane', undefined)).toBeFalsy();
    expect(shown('annotations.multiLane', [annotationFrame(1)])).toBe(false);
    expect(shown('annotations.multiLane', [annotationFrame(1), annotationFrame(0)])).toBe(false);
    expect(shown('annotations.multiLane', [annotationFrame(1), annotationFrame(2)])).toBe(true);
  });

  it('shows "Hide lines and areas" only when the panel has an annotation frame, as core', () => {
    expect(shown('annotations', undefined)).toBe(false);
    expect(shown('annotations', [toDataFrame({ fields: [] })])).toBe(false);
    expect(shown('annotations', [annotationFrame(0)])).toBe(true);
  });

  it('hides both options for boxplot and in histogram mode', () => {
    const frames = [annotationFrame(1), annotationFrame(2)];
    const showIf = (path: string, options: object) =>
      // Grafana 13.3 adds the context argument (grafana/grafana#132398). The 13.2 types do not have it.
      (items().find((entry) => entry.path === path)!.showIf as (...args: unknown[]) => boolean)(
        options as PanelOptions,
        [],
        frames,
        {
          fieldConfig: { defaults: {}, overrides: [] },
        }
      );
    for (const path of ['annotations.multiLane', 'annotations']) {
      for (const seriesType of ['Auto', 'line', 'bar', 'scatter', 'effectScatter', 'candlestick']) {
        expect(showIf(path, { seriesType })).toBe(true);
      }
      expect(showIf(path, { seriesType: 'boxplot' })).toBe(false);
      expect(showIf(path, { seriesType: 'line', histogram: true })).toBe(false);
    }
  });
});
