import { type DataFrame, type FieldConfigSource } from '@grafana/data';
import { seriesTypePath } from 'editor/constants';
import { type PanelOptions } from 'types';

/**
 * The part of the editor context that `showIf` reads. Grafana 13.3 adds the `context` argument of `showIf`, with
 * `context.fieldConfig` (grafana/grafana#132398). Grafana 13.2 and older do not give it.
 * https://github.com/grafana/grafana/pull/132398
 */
export interface ShowIfContext {
  fieldConfig?: FieldConfigSource;
}

/** The id of the per-field Series type property in an override. */
const seriesTypeOverrideId = `custom.${seriesTypePath}`;

/**
 * True when a bar chart option applies: the panel series type is `bar`, a field override sets the `bar` series
 * type, or the host gives no field config. With no field config, the host cannot see the overrides, so the option
 * shows. `Auto` never resolves to `bar` (see `resolveAutoSeriesType`).
 */
export function isBarOptionShown(options: PanelOptions, context?: ShowIfContext): boolean {
  if (options[seriesTypePath] === 'bar' || context?.fieldConfig === undefined) {
    return true;
  }
  return context.fieldConfig.overrides.some((override) =>
    override.properties.some((property) => property.id === seriesTypeOverrideId && property.value === 'bar')
  );
}

/**
 * The `showIf` of a bar chart option. It uses a rest parameter, so `Function.length` is 1: the `viz-options.json`
 * build (`src/standalone/vizOptions.ts`) reads a `length` above 1 as a condition on the data.
 * https://grafana.com/developers/plugin-tools/how-to-guides/panel-plugins/add-support-for-panel-options
 */
export const showIfBarOption = (
  options: PanelOptions,
  ...rest: [data?: DataFrame[], annotations?: DataFrame[], context?: ShowIfContext]
): boolean => isBarOptionShown(options, rest[2]);
