import { type GrafanaTheme2 } from '@grafana/data';
import { type TimeZone } from '@grafana/schema';
import { type TooltipOption, type TopLevelFormatterParams } from 'echarts/types/dist/shared';
import { SILENT_TOOLTIP_CHROME, seriesTooltip } from 'lib/echarts/tooltip/option';
import { type TooltipModel, type TooltipSink } from 'lib/echarts/tooltip/types';
import { type GeoMarker, type GeoMarkers } from 'lib/grafana/geo/markers';
import { getMarkerTooltipRows } from 'lib/grafana/geo/tooltip';

/**
 * The core Geomap tooltip modes (`TooltipMode` of the core panel config). `details` shows the tooltip on hover.
 * `none` shows it on click only.
 * https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/panelcfg.cue
 */
export const GeoTooltipMode = { Details: 'details', None: 'none' } as const;

/**
 * The panel `tooltip` of the geo family. The markers series give the content (see `geoMarkerTooltip`), and the
 * React overlay draws it. A click pins the tooltip in each mode, as core: `useEChartsTooltip` replays the clicked
 * item with `showTip`. With mode `none`, only a click shows the tooltip.
 * https://echarts.apache.org/en/option.html#tooltip.triggerOn
 */
export function buildGeoTooltipOption(mode: string | undefined): TooltipOption {
  return {
    show: true,
    trigger: 'item',
    triggerOn: mode === GeoTooltipMode.None ? 'click' : 'mousemove',
    // The content comes from the series formatter. An item with no formatter shows nothing.
    formatter: () => '',
    ...SILENT_TOOLTIP_CHROME,
  };
}

/** What the tooltip of a markers series needs. */
export interface GeoTooltipContext {
  theme: GrafanaTheme2;
  timeZone?: TimeZone;
  tooltipSink?: TooltipSink;
}

/**
 * The series `tooltip` of the markers in `data`, in the data order of the series. The tooltip has one row for each
 * field of the marker row, as core `DataHoverView`. The header has the layer name, as the tab of core `DataHoverTabs`.
 * The pinned footer shows the data links of each
 * field, deduplicated, as core.
 * https://echarts.apache.org/en/option.html#series-scatter.tooltip
 */
export function geoMarkerTooltip(layer: GeoMarkers, data: GeoMarker[], ctx: GeoTooltipContext) {
  const { frame } = layer;
  const produce = (params: TopLevelFormatterParams): TooltipModel => {
    const item = Array.isArray(params) ? params[0] : params;
    const marker = item ? data[item.dataIndex] : undefined;
    const rows = frame && marker ? getMarkerTooltipRows(frame, marker.rowIndex, ctx.theme, ctx.timeZone) : [];
    // The series index on each row lets the pinned footer find the sources of the clicked series.
    return {
      header: { label: layer.name, value: '' },
      rows: rows.map((row) => ({ ...row, seriesIndex: item?.seriesIndex })),
    };
  };
  return seriesTooltip(produce, ctx.tooltipSink);
}
