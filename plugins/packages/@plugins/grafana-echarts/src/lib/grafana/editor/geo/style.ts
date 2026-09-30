import { type PanelOptionsEditorBuilder } from '@grafana/data';
import { type MapLayerOptions } from '@grafana/schema';
import { DEFAULT_MARKER_STYLE, type MarkerStyleConfig, styleUsesText } from 'lib/grafana/geo/dimensions';
import { GeoColorDimensionEditor } from './GeoColorDimensionEditor';
import { GeoScalarDimensionEditor } from './GeoScalarDimensionEditor';
import { GeoScaleDimensionEditor } from './GeoScaleDimensionEditor';
import { GeoTextDimensionEditor } from './GeoTextDimensionEditor';
import { type NumberRange } from './numberRange';

/** The path of the style options of a layer. */
export const STYLE_PATH = 'config.style';

const MARKER_FOLDER = 'img/icons/marker';

/**
 * The core marker files that the panel draws (`lib/echarts/geo/symbols.ts`). Core also lists the other files of
 * the marker folder and custom URLs; the panel draws those as a circle (#451).
 */
export const MARKER_SYMBOLS = ['circle', 'square', 'triangle', 'star', 'cross', 'x-mark', 'plane'].map((name) => ({
  value: `${MARKER_FOLDER}/${name}.svg`,
  label: name,
  imgUrl: `public/${MARKER_FOLDER}/${name}.svg`,
}));

const alignOptions = <T extends string>(values: T[]) =>
  values.map((value) => ({ value, label: value.charAt(0).toUpperCase() + value.slice(1) }));

/**
 * The style options of a markers or route layer (`config.style`), as core `StyleEditor`. The markers layer sets
 * `displayRotation`, the route layer does not. Core shows
 * them in one editor. Here each option is an item, so the options pane search finds it. The size, color, rotation
 * and text items are dimension editors, with a fixed mode and a field mode.
 * Core: https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/editor/StyleEditor.tsx
 * and `registerOptionsUI` in
 * https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/layers/data/markersLayer.tsx
 * https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/geomap/#markers-layer
 */
export function addStyleFields(
  builder: PanelOptionsEditorBuilder<MapLayerOptions>,
  style: MarkerStyleConfig | undefined,
  displayRotation = true
): void {
  const path = (key: string) => `${STYLE_PATH}.${key}`;
  builder
    .addCustomEditor<NumberRange, unknown>({
      id: path('size'),
      path: path('size'),
      name: 'Size',
      editor: GeoScaleDimensionEditor,
      settings: { min: 1, max: 100 },
    })
    .addSelect({
      path: path('symbol.fixed'),
      name: 'Symbol',
      settings: { options: MARKER_SYMBOLS, isClearable: true },
    })
    .addRadio({
      path: path('symbolAlign.vertical'),
      name: 'Symbol vertical align',
      settings: { options: alignOptions(['top', 'center', 'bottom']) },
    })
    .addRadio({
      path: path('symbolAlign.horizontal'),
      name: 'Symbol horizontal align',
      settings: { options: alignOptions(['left', 'center', 'right']) },
    })
    .addCustomEditor({
      id: path('color'),
      path: path('color'),
      name: 'Color',
      editor: GeoColorDimensionEditor,
    })
    .addSliderInput({
      path: path('opacity'),
      name: 'Fill opacity',
      settings: { min: 0, max: 1, step: 0.1 },
    });
  if (displayRotation) {
    builder.addCustomEditor<NumberRange, unknown>({
      id: path('rotation'),
      path: path('rotation'),
      name: 'Rotation angle',
      editor: GeoScalarDimensionEditor,
      settings: { min: DEFAULT_MARKER_STYLE.rotation.min, max: DEFAULT_MARKER_STYLE.rotation.max },
    });
  }
  builder.addCustomEditor({
    id: path('text'),
    path: path('text'),
    name: 'Text label',
    editor: GeoTextDimensionEditor,
  });

  // Core shows the text options only for a style with a text.
  if (!styleUsesText(style?.text)) {
    return;
  }
  builder
    .addNumberInput({ path: path('textConfig.fontSize'), name: 'Font size' })
    .addNumberInput({ path: path('textConfig.offsetX'), name: 'X offset' })
    .addNumberInput({ path: path('textConfig.offsetY'), name: 'Y offset' })
    .addRadio({
      path: path('textConfig.textAlign'),
      name: 'Align',
      settings: { options: alignOptions(['left', 'center', 'right']) },
    })
    .addRadio({
      path: path('textConfig.textBaseline'),
      name: 'Baseline',
      settings: { options: alignOptions(['top', 'middle', 'bottom']) },
    });
}
