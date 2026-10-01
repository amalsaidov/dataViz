import { type PanelOptionsEditorBuilder, type SelectFieldConfigSettings } from '@grafana/data';
import {
  ANIMATION_ENABLED_DEFAULT,
  animationEnabledPath,
  animationName,
  PERFORMANCE_DOWNSAMPLING_DEFAULT,
  PERFORMANCE_SHOW_POINTS_DEFAULT,
  performanceDownsamplingName,
  performanceDownsamplingPath,
  performanceModeOptions,
  performanceShowPointsName,
  performanceShowPointsPath,
} from 'editor/constants';
import { cartesianGraphStylesCategoryName } from 'editor/cartesian';
import { type PerformanceMode } from 'editor/types';
import { addAdvancedBooleanSwitch, type ExtraShowIf } from 'lib/grafana/editor/common/advanced-options';
import { type PanelOptions } from 'types';

/**
 * Register the "Performance" options for the cartesian time-series fast path.
 * Show points has core parity, so it is Default tier in "Graph styles". Downsampling
 * and Animation are ECharts-only, so the `addAdvanced*` helpers put them in the
 * Advanced tier and category. These override the density-based auto behavior
 * resolved in `lib/echarts/performance/resolvers.ts`:
 *
 * - **Show points** (`performance.showPoints`, default Auto): per-series
 *   `showSymbol`, decided from the chart's **total** point count — marker count is
 *   what costs, so many short series are as expensive as one long one. Auto hides
 *   markers once the total crosses the threshold, except on a series that draws no
 *   line and would then render as nothing; Always/Never force it.
 * - **Downsampling** (`performance.downsampling`, default on): arms LTTB
 *   `sampling` on every line series. ECharts itself decides when it fires, gating
 *   on the rendered width, so this is a no-op until a series has more points than
 *   the axis has pixels.
 * - **Animation** (`animation.enabled`, default off): the panel-wide `animation`
 *   flag, an opt-in switch. Density thresholds were tried and removed — they
 *   could not fire before the render that needed them (see `resolveAnimation`) —
 *   so animation is simply off unless asked for. Because off *is* the default, a
 *   plain switch is now unambiguous: what it shows is what the chart does.
 *
 * `lineShowIf` hides Show points and Downsampling when no line series reads them. The caller gives it, so `common/`
 * does not import family code.
 */
export function addPerformanceOptions(builder: PanelOptionsEditorBuilder<PanelOptions>, lineShowIf?: ExtraShowIf) {
  // Core Time series "Show points" (`custom.showPoints`, contract #130), so Default tier.
  builder.addRadio<PerformanceMode, SelectFieldConfigSettings<PerformanceMode>>({
    category: [cartesianGraphStylesCategoryName],
    path: performanceShowPointsPath,
    name: performanceShowPointsName,
    description: 'Point markers on line series. Auto hides them once the chart has many points in total',
    defaultValue: PERFORMANCE_SHOW_POINTS_DEFAULT,
    settings: { options: performanceModeOptions },
    showIf: lineShowIf,
  });

  addAdvancedBooleanSwitch(builder, {
    path: performanceDownsamplingPath,
    name: performanceDownsamplingName,
    description: 'Sample dense line series toward pixel resolution (LTTB) to cut drawn points',
    defaultValue: PERFORMANCE_DOWNSAMPLING_DEFAULT,
    showIf: lineShowIf,
  });

  addAdvancedBooleanSwitch(builder, {
    path: animationEnabledPath,
    name: animationName,
    description: 'Animate on load and update. Off by default; costly on large datasets',
    defaultValue: ANIMATION_ENABLED_DEFAULT,
  });
}
