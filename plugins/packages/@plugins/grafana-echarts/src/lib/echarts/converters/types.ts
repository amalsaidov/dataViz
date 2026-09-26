import type { Field, ValueFormatter } from '@grafana/data';
import { type LineSeriesOption } from 'echarts';
import { type OptionDataValue } from 'echarts/types/src/util/types';
import { type CategoryAxisBaseOption } from 'echarts/types/src/coord/axisCommonTypes';
import { type CartesianOption } from 'lib/echarts/charts/types';

/**
 * The two data-dependent pieces a category-axis cartesian chart needs: the
 * shared `categories` (x-axis labels) and the `series`. The caller merges these
 * into a base cartesian option with `xAxis.type: 'category'`.
 *
 * Generic over the series option so it is shared by both the single-value
 * category converter (default: one line/bar/scatter series per numeric field)
 * and the multi-value converter (a single candlestick/boxplot series).
 */
/** Bar placement a cartesian converter needs from the chart module. */
export interface CartesianLayout {
  /** Horizontal bars (category axis on y). */
  horizontal: boolean;
  /** Plot length (px) along the category or time axis, to size the bar value labels. */
  plotLength?: number;
}

export interface CategoryCartesianData<S = CartesianOption['series']> {
  categories: CategoryAxisBaseOption['data'];
  series: S;
}
/**
 * One resolved pie slice, shared by the chart, DOM legend, and tooltip so all
 * three agree on the same slice set, values, colors, and hidden state (rather
 * than each re-deriving the selection and drifting).
 */
export interface PieSliceModel {
  /** Slice label: the reduced field's display name (Calculate) or a row name (All values). */
  name: string;
  /** Reduced slice value; `undefined` when the reduction is non-finite (empty/all-null). */
  value: number | undefined;
  /** Resolved slice/swatch color (a fixed-color override always wins). */
  color: string;
  /** Hidden via the legend visibility toggle; kept in the model so the legend can grey it. */
  hidden: boolean;
  /**
   * A single-value numeric field carrying this slice's value plus the source
   * field's unit/decimals config, for the legend's calc columns
   * (`getCalcDisplayValues`) — a slice is one value, so any reducer resolves to it.
   */
  field: Field;
  /**
   * The real source field (with its `getLinks` supplier and `config.links`) and
   * the row this slice reduced, so the tooltip footer can surface the slice's
   * data links. The synthetic {@link field} above is rebuilt for the legend and
   * carries no links, so it cannot serve this. `undefined` when the slice has no
   * backing frame column (the "No data" placeholder).
   */
  sourceField?: Field;
  /** Row index within {@link sourceField} the slice's value came from. */
  sourceRowIndex?: number;
}

/** One series before it becomes ECharts data: its field, its values, and how it draws. */
export interface CartesianValueSource {
  field: Field<number>;
  /** Field values, positioned against the x values or categories. */
  values: Array<number | null>;
  /** True for a bar series in the stack. */
  stacked: boolean;
  isBar: boolean;
}

/** Inputs of {@link buildCartesianData}. */
export interface CartesianDataInput {
  /** X value of each point on a time axis; omitted on a category axis, where the index is the x. */
  xs?: ArrayLike<OptionDataValue>;
  drawn: Array<number | null>;
  values: Array<number | null>;
  horizontal: boolean;
  /** Per-bar colors from {@link getPerBarColors}. */
  colors?: Array<string | undefined>;
  /** Value-end corner radius (px) of a bar. 0 or unset draws square corners. */
  radius?: number;
  barFillOpacity?: number;
}

/** A source with what {@link resolveSeriesValues} needs to build its data. */
export interface CartesianSeriesSource extends CartesianValueSource {
  formatValue: ValueFormatter;
  /** The "Color by field" field of the source frame, if set. */
  colorField?: Field;
  /** Frame row of each point, to read the "Color by field" value. */
  rows: Array<number | null>;
  /** Series color: the fill of bars that no value mapping colors. */
  color: string;
  /** X value of each point on a time axis; omitted on a category axis. */
  xs?: ArrayLike<OptionDataValue>;
}

/** Placement inputs: orientation and the bar bands along the plot. */
export interface CartesianBandLayout {
  horizontal: boolean;
  /** Bands along the category (or time) axis: categories, or time slots. */
  bandCount: number;
  /** Plot length (px) along that axis. Unknown sizes no labels automatically. */
  plotLength?: number;
}

/** The data-dependent part of one series for `buildCartesianSeries`. */
export interface ResolvedSeriesValues {
  data: LineSeriesOption['data'];
  labelTexts?: string[];
  labelFontSize?: number | null;
  barGaps?: { barCategoryGap: string; barGap: string };
}
