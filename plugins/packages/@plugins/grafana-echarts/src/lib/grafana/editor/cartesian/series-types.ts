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

/** When the option shows in histogram mode. Histogram mode ignores the series type (`charts/cartesian.ts`). */
export interface SeriesTypesShowIf {
  histogram?: boolean;
}

/** The id of the per-field Series type property in an override. */
const seriesTypeOverrideId = `custom.${seriesTypePath}`;

/**
 * True when an option for a set of series types applies. With Histogram on, `histogram` gives the result. Else the
 * panel series type is in `types` (unset and `Auto` count as `line`), a field override sets a type in `types`, or the
 * host gives no field config. With no field config, the host cannot see the overrides, so the option shows.
 */
export function isSeriesTypesOptionShown(
  options: PanelOptions,
  types: readonly string[],
  { histogram = false }: SeriesTypesShowIf = {},
  context?: ShowIfContext
): boolean {
  if (options.histogram === true) {
    return histogram;
  }
  const seriesType = options[seriesTypePath];
  const panelType = seriesType === undefined || seriesType === 'Auto' ? 'line' : seriesType;
  if (types.includes(panelType) || context?.fieldConfig === undefined) {
    return true;
  }
  return context.fieldConfig.overrides.some((override) =>
    override.properties.some(
      (property) =>
        property.id === seriesTypeOverrideId && typeof property.value === 'string' && types.includes(property.value)
    )
  );
}

/**
 * The `showIf` of an option for a set of series types. It uses a rest parameter, so `Function.length` is 1: the
 * `viz-options.json` build (`src/standalone/vizOptions.ts`) reads a `length` above 1 as a condition on the data.
 * https://grafana.com/developers/plugin-tools/how-to-guides/panel-plugins/add-support-for-panel-options
 */
export const showIfSeriesTypes =
  (types: readonly string[], mode?: SeriesTypesShowIf) =>
  (options: PanelOptions, ...rest: [data?: DataFrame[], annotations?: DataFrame[], context?: ShowIfContext]): boolean =>
    isSeriesTypesOptionShown(options, types, mode, rest[2]);

/** The `showIf` of a bar option that histogram mode ignores. */
export const showIfBarOption = showIfSeriesTypes(['bar']);
