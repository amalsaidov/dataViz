import { type YAXisOption } from 'echarts/types/src/coord/cartesian/AxisModel';

/** An axis end: a fixed value, or a function of the data extent. */
type AxisEnd = number | ((extent: { min: number; max: number }) => number);

export interface CartesianYAxes {
  /** One value axis per distinct unit, in first-appearance order. */
  yAxis: YAXisOption[];
  /** Axis index for each input field, aligned to `fields` order. */
  seriesYAxisIndex: number[];
  /** Visible (non-hidden) axis counts per side, for reserving grid space. */
  leftAxisCount: number;
  rightAxisCount: number;
  /** Visible axes with a name ("Axis > Label") per side, for reserving grid space. */
  leftNameCount?: number;
  rightNameCount?: number;
}

/** Range keys of a value axis. */
export interface AxisRange {
  min?: AxisEnd;
  max?: AxisEnd;
  scale?: boolean;
  type?: 'log';
  logBase?: number;
}
