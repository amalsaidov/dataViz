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
      description: 'Yes: make the buckets from the data. No: use the buckets of the data.',
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
      description: 'The scale of the calculated Y buckets.',
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
    .addUnitPicker({
      path: 'yAxis.unit',
      name: 'Unit',
      description: 'The unit of the Y axis values.',
      category: yAxisCategory,
      showIf: isBinned,
    })
    .addNumberInput({
      path: 'yAxis.decimals',
      name: 'Decimals',
      description: 'The number of decimals of the Y axis values. Empty picks a number.',
      category: yAxisCategory,
      settings: { placeholder: 'Auto' },
      showIf: isBinned,
    })
    .addNumberInput({
      path: 'yAxis.min',
      name: 'Min value',
      description: 'The lowest value of the Y axis. Empty uses the data.',
      category: yAxisCategory,
      settings: { placeholder: 'Auto' },
      showIf: isBinned,
    })
    .addNumberInput({
      path: 'yAxis.max',
      name: 'Max value',
      description: 'The highest value of the Y axis. Empty uses the data.',
      category: yAxisCategory,
      settings: { placeholder: 'Auto' },
      showIf: isBinned,
    })
    .addBooleanSwitch({
      path: 'yAxis.reverse',
      name: 'Reverse',
      description: 'Show the Y axis from top to bottom.',
      defaultValue: false,
      category: yAxisCategory,
      showIf: isBinned,
    })
    .addRadio({
      path: 'color.mode',
      name: 'Mode',
      description: 'Scheme: a color gradient. Opacity: one color with a different opacity.',
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
      description: 'The color of the cells in opacity mode.',
      defaultValue: 'dark-orange',
      category: colorsCategory,
      showIf: isOpacity,
    })
    .addRadio({
      path: 'color.scale',
      name: 'Scale',
      description: 'How the opacity changes with the value.',
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
      description: 'The exponent of the exponential opacity scale.',
      defaultValue: 0.5,
      category: colorsCategory,
      settings: { min: 0.1, max: 2, step: 0.1 },
      showIf: (options) => isOpacity(options) && options.color?.scale === 'exponential',
    })
    .addNumberInput({
      path: 'color.min',
      name: 'Start color from value',
      description: 'The value that gets the first color. Empty uses the lowest value.',
      category: colorsCategory,
      settings: { placeholder: 'Auto (min)' },
      showIf: isBinned,
    })
    .addNumberInput({
      path: 'color.max',
      name: 'End color from value',
      description: 'The value that gets the last color. Empty uses the highest value.',
      category: colorsCategory,
      settings: { placeholder: 'Auto (max)' },
      showIf: isBinned,
    })
    .addSliderInput({
      path: 'cellGap',
      name: 'Cell gap',
      description: 'The gap between the cells, in pixels.',
      defaultValue: 1,
      category: cellCategory,
      settings: { min: 0, max: 25 },
      showIf: isBinned,
    })
    .addNumberInput({
      path: 'filterValues.le',
      name: 'Hide cells with values <=',
      description: 'Do not show a cell with a value that is this value or less.',
      defaultValue: 1e-9,
      category: cellCategory,
      settings: { placeholder: 'None' },
      showIf: isBinned,
    })
    .addNumberInput({
      path: 'filterValues.ge',
      name: 'Hide cells with values >=',
      description: 'Do not show a cell with a value that is this value or more.',
      category: cellCategory,
      settings: { placeholder: 'None' },
      showIf: isBinned,
    });
}
