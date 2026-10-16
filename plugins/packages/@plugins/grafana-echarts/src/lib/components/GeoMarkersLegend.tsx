import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { getMarkerSymbol } from 'lib/echarts/geo/symbols';
import { type MarkerLegend, type MarkerLegendBody } from 'lib/grafana/geo/legend';
import React from 'react';

interface Props {
  legends: MarkerLegend[];
}

/** The symbol of a fixed color legend, drawn from the same path as the marker. */
function symbolSvg(body: Extract<MarkerLegendBody, { kind: 'symbol' }>, className: string) {
  const { symbol, kind } = getMarkerSymbol(body.symbol);
  const style = { fill: body.color, opacity: body.opacity };
  if (kind === 'circle') {
    return (
      <svg className={className} viewBox="-1 -1 2 2" style={style} aria-label="Symbol">
        <circle r={1} />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox={kind === 'icon' ? '0 0 24 24' : '-1 -1 2 2'} style={style} aria-label="Symbol">
      <path d={symbol.replace('path://', '')} />
    </svg>
  );
}

/**
 * The legends of the markers layers in the lower left corner of the map, as core `MarkersLegend` in the
 * `bottomLeft` slot of `GeomapOverlay`. A fixed color shows the symbol, a continuous scheme a gradient, and
 * thresholds one color for each step.
 * Core: https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/components/MarkersLegend.tsx
 */
export const GeoMarkersLegend: React.FC<Props> = ({ legends }) => {
  const styles = useStyles2(getStyles);
  if (!legends.length) {
    return null;
  }
  return (
    <div className={styles.wrapper} data-testid="geo-markers-legend">
      {legends.map(({ name, body }, i) => (
        <div key={`${i}/${name}`} className={styles.infoWrap}>
          <div className={styles.layerName}>{name}</div>
          {body.kind === 'symbol' && <div className={styles.fixed}>{symbolSvg(body, styles.symbol)}</div>}
          {body.kind === 'scale' && (
            <div className={styles.scale}>
              <div
                className={styles.gradient}
                style={{ background: `linear-gradient(to right, ${body.colors.join(', ')})` }}
              />
              <div className={styles.scaleLabels}>
                <span>{body.min}</span>
                <span>{body.max}</span>
              </div>
            </div>
          )}
          {body.kind === 'thresholds' && (
            <div className={styles.thresholds}>
              {body.items.map((item, j) => (
                <div key={`${j}/${item.label}`} className={styles.item}>
                  <i style={{ background: item.color }} />
                  {item.label}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// The styles of core `MarkersLegend` and `GeomapOverlay`.
const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    position: 'absolute',
    bottom: 8,
    left: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    zIndex: 1,
  }),
  infoWrap: css({
    display: 'flex',
    flexDirection: 'column',
    background: theme.colors.background.secondary,
    padding: theme.spacing(1),
    borderBottom: `2px solid ${theme.colors.border.strong}`,
    minWidth: 150,
  }),
  layerName: css({ fontSize: theme.typography.body.fontSize }),
  fixed: css({ paddingLeft: 10, paddingTop: 5, minWidth: 80 }),
  symbol: css({ display: 'block', height: 18, width: 18, margin: 'auto' }),
  scale: css({ paddingLeft: 10, paddingTop: 10, minWidth: 200, fontSize: theme.typography.bodySmall.fontSize }),
  gradient: css({ height: 10, borderRadius: theme.shape.radius.default }),
  scaleLabels: css({ display: 'flex', justifyContent: 'space-between' }),
  thresholds: css({
    lineHeight: '18px',
    display: 'flex',
    flexDirection: 'column',
    fontSize: theme.typography.bodySmall.fontSize,
    padding: '5px 10px 0',
    i: {
      width: 15,
      height: 15,
      float: 'left',
      marginRight: 8,
      opacity: 0.7,
      borderRadius: theme.shape.radius.circle,
    },
  }),
  item: css({ whiteSpace: 'nowrap' }),
});
