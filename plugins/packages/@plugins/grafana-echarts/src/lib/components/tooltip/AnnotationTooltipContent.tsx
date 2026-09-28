import { css } from '@emotion/css';
import { type GrafanaTheme2, textUtil } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { type AnnotationTooltipContent as Content } from 'lib/echarts/tooltip/types';
import React from 'react';

interface Props {
  annotation: Content;
}

/**
 * The body of the tooltip of an annotation marker, as core's `AnnotationTooltipBody`: the title
 * and the text as sanitized HTML, and the tags. The `VizTooltipHeader` above it shows the time.
 * It has no edit or delete buttons (see the `annotate` todo in `EChartsTooltip`).
 *
 * The tags are plain elements in one theme color, not core `Tag` with a color for each name:
 * `Tag`, `Stack` and the tag colors add about 4.9 KB to the viz bundle, over its size limit.
 * https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/timeseries/plugins/annotations/AnnotationTooltipBody.tsx
 * https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/text/sanitize.ts
 */
export const AnnotationTooltipContent: React.FC<Props> = ({ annotation: { title, text, tags } }) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.body}>
      {title && <div dangerouslySetInnerHTML={{ __html: textUtil.sanitize(title) }} />}
      {text && <div dangerouslySetInnerHTML={{ __html: textUtil.sanitize(text) }} />}
      {tags.map((tag, index) => (
        // The tags are a fixed list, so the index is a stable key.
        <span key={index}>{tag}</span>
      ))}
    </div>
  );
};

// Core styles (AnnotationMarker `annoBox`, AnnotationTooltipBody, Tag).
const getStyles = (theme: GrafanaTheme2) => ({
  body: css({
    whiteSpace: 'initial',
    padding: theme.spacing(1),
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    '> div': { paddingBottom: theme.spacing(1) },
    a: { color: theme.colors.text.link },
    '> span': {
      marginRight: theme.spacing(0.5),
      padding: theme.spacing(0.25, 0.75),
      border: `1px solid ${theme.colors.border.medium}`,
      borderRadius: theme.shape.radius.default,
      background: theme.colors.background.secondary,
      color: theme.colors.text.primary,
    },
  }),
});
