import { type PanelOptionsEditorBuilder } from '@grafana/data';
import { type PanelOptions } from 'types';
import { ScaleEditor } from './ScaleEditor';

const heatmapCategory = ['Heatmap'];
const yAxisCategory = ['Y Axis'];
const colorsCategory = ['Colors'];
const cellCategory = ['Cell display'];

/** The options below apply to the binned layout only. */
const isBinned = (options: PanelOptions) => options.heatmapLayout !== 'matrix';
const isCalculated = (options: PanelOptions) => isBinned(options) && options.calculate === true;
const isOpacity = (options: PanelOptions) => isBinned(options) && options.color?.mode === 'opacity';

/**
 * Register the core Grafana heatmap options that the binned layout reads,
 * under core's own paths, categories and defaults.
 * https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/heatmap/
 */
export function addCoreHeatmapOptions(builder: PanelOptionsEditorBuilder<PanelOptions>) {
  builder
    .addRadio({
      path: 'calculate',
      name: 'Calculate from data',
      defaultValue: false,
      category: heatmapCategory,
      settings: {
        options: [
          { label: 'Yes', value: true },
          { label: 'No', value: false },
        ],
      },
      showIf: isBinned,
    })
    .addTextInput({
      path: 'calculation.xBuckets.value',
      name: 'X bucket size',
      description: 'A duration, for example 1m. Empty picks a size from the data.',
      category: heatmapCategory,
      settings: { placeholder: 'Auto' },
      showIf: isCalculated,
    })
    .addCustomEditor({
      id: 'calculation.yBuckets.scale',
      path: 'calculation.yBuckets.scale',
      name: 'Y bucket scale',
      category: heatmapCategory,
      editor: ScaleEditor,
      showIf: isCalculated,
    })
    .addTextInput({
      path: 'calculation.yBuckets.value',
      name: 'Y bucket size',
      description: 'A size on a linear scale, or the number of splits per magnitude on a log scale.',
      category: heatmapCategory,
      settings: { placeholder: 'Auto' },
      showIf: isCalculated,
    })
    // No default: core stores "Auto" as an unset scale.
    .addCustomEditor({
      id: 'rowsFrame.yBucketScale',
      path: 'rowsFrame.yBucketScale',
      name: 'Y bucket scale',
      description: 'For bucketed data. Auto draws every bucket at the same height.',
      category: yAxisCategory,
      editor: ScaleEditor,
      settings: { allowAuto: true },
      showIf: (options) => isBinned(options) && options.calculate !== true,
    })
    .addUnitPicker({ path: 'yAxis.unit', name: 'Unit', category: yAxisCategory, showIf: isBinned })
    .addNumberInput({
      path: 'yAxis.decimals',
      name: 'Decimals',
      category: yAxisCategory,
      settings: { placeholder: 'Auto' },
      showIf: isBinned,
    })
    .addNumberInput({
      path: 'yAxis.min',
      name: 'Min value',
      category: yAxisCategory,
      settings: { placeholder: 'Auto' },
      showIf: isBinned,
    })
    .addNumberInput({
      path: 'yAxis.max',
      name: 'Max value',
      category: yAxisCategory,
      settings: { placeholder: 'Auto' },
      showIf: isBinned,
    })
    .addBooleanSwitch({
      path: 'yAxis.reverse',
      name: 'Reverse',
      defaultValue: false,
      category: yAxisCategory,
      showIf: isBinned,
    })
    .addRadio({
      path: 'color.mode',
      name: 'Mode',
      defaultValue: 'scheme',
      category: colorsCategory,
      settings: {
        options: [
          { label: 'Scheme', value: 'scheme' },
          { label: 'Opacity', value: 'opacity' },
        ],
      },
      showIf: isBinned,
    })
    .addColorPicker({
      path: 'color.fill',
      name: 'Color',
      defaultValue: 'dark-orange',
      category: colorsCategory,
      showIf: isOpacity,
    })
    .addRadio({
      path: 'color.scale',
      name: 'Scale',
      defaultValue: 'exponential',
      category: colorsCategory,
      settings: {
        options: [
          { label: 'Exponential', value: 'exponential' },
          { label: 'Linear', value: 'linear' },
        ],
      },
      showIf: isOpacity,
    })
    .addSliderInput({
      path: 'color.exponent',
      name: 'Exponent',
      defaultValue: 0.5,
      category: colorsCategory,
      settings: { min: 0.1, max: 2, step: 0.1 },
      showIf: (options) => isOpacity(options) && options.color?.scale === 'exponential',
    })
    .addNumberInput({
      path: 'color.min',
      name: 'Start color from value',
      category: colorsCategory,
      settings: { placeholder: 'Auto (min)' },
      showIf: isBinned,
    })
    .addNumberInput({
      path: 'color.max',
      name: 'End color from value',
      category: colorsCategory,
      settings: { placeholder: 'Auto (max)' },
      showIf: isBinned,
    })
    .addSliderInput({
      path: 'cellGap',
      name: 'Cell gap',
      defaultValue: 1,
      category: cellCategory,
      settings: { min: 0, max: 25 },
      showIf: isBinned,
    })
    .addNumberInput({
      path: 'filterValues.le',
      name: 'Hide cells with values <=',
      defaultValue: 1e-9,
      category: cellCategory,
      settings: { placeholder: 'None' },
      showIf: isBinned,
    })
    .addNumberInput({
      path: 'filterValues.ge',
      name: 'Hide cells with values >=',
      category: cellCategory,
      settings: { placeholder: 'None' },
      showIf: isBinned,
    });
}
