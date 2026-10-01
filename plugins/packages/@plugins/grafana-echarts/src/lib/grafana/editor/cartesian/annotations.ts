import { type DataFrame, DataTopic, type PanelOptionsEditorBuilder } from '@grafana/data';
import { AnnotationLinesSwitchEditor } from 'lib/grafana/editor/cartesian/AnnotationLinesSwitchEditor';
import { type PanelOptions } from 'types';
import { type ShowIfContext, showIfAnnotationOption } from './series-types';

// The core "Annotations" options of Time series and Candlestick, with the same paths, names and `showIf`.
// Core reference: `addAnnotationOptions` in public/app/features/panel/options/builder/annotations.ts.
// The core "Enable annotation clustering" switch (`annotations.clustering`) is not here: the chart does not
// cluster markers yet. The fallback map keeps its value (`compat/timeseries.json`).
// https://grafana.com/developers/plugin-tools/how-to-guides/panel-plugins/custom-panel-option-editors

const category = ['Annotations'];

const annotationFrames = (annotations: DataFrame[] | undefined) =>
  (annotations ?? []).filter((frame) => frame.meta?.dataTopic === DataTopic.Annotations);

/** Register the core annotation options. Boxplot and histogram mode hide them. Rendered by `readAnnotationDisplay`. */
export function addCartesianAnnotationOptions(builder: PanelOptionsEditorBuilder<PanelOptions>) {
  builder.addBooleanSwitch({
    path: 'annotations.multiLane',
    category,
    name: 'Enable multi-row annotations',
    description: 'Breaks each annotation frame into a separate row in the visualization',
    showIf: (options, data, annotations, context?: ShowIfContext) =>
      showIfAnnotationOption(options, data, annotations, context) &&
      annotationFrames(annotations).filter((frame) => frame.length > 0).length > 1,
  });

  builder.addCustomEditor({
    id: 'canvasSwitchEditor',
    path: 'annotations',
    category,
    name: 'Hide lines and areas',
    description: 'Hides annotation indicator lines and shaded regions',
    editor: AnnotationLinesSwitchEditor,
    defaultValue: undefined,
    showIf: (options, data, annotations, context?: ShowIfContext) =>
      showIfAnnotationOption(options, data, annotations, context) && annotationFrames(annotations).length > 0,
  });
}
