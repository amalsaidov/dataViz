import { css } from '@emotion/css';
import { type GrafanaTheme2, textUtil } from '@grafana/data';
import { Stack, Tag, useStyles2 } from '@grafana/ui';
import { type AnnotationTooltipContent as Content } from 'lib/echarts/tooltip/types';
import React from 'react';

interface Props {
  annotation: Content;
}

/**
 * The body of the tooltip of an annotation marker, as core's `AnnotationTooltipBody`: the title
 * and the text as sanitized HTML, and the tags as `Tag`, with a color for each tag name. The
 * `VizTooltipHeader` above it shows the time. It has no edit or delete buttons.
 * https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/timeseries/plugins/annotations/AnnotationTooltipBody.tsx
 * https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/text/sanitize.ts
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/information-tag--docs
 */
export const AnnotationTooltipContent: React.FC<Props> = ({ annotation: { title, text, tags } }) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.body}>
      {title && <div dangerouslySetInnerHTML={{ __html: textUtil.sanitize(title) }} />}
      {text && <div className={styles.text} dangerouslySetInnerHTML={{ __html: textUtil.sanitize(text) }} />}
      {tags.length > 0 && (
        <Stack gap={0.5} wrap={true}>
          {tags.map((tag, index) => (
            // The tags are a fixed list, so the index is a stable key.
            <Tag name={tag} key={index} />
          ))}
        </Stack>
      )}
    </div>
  );
};

// Core styles (AnnotationMarker `annoBox`, AnnotationTooltipBody).
const getStyles = (theme: GrafanaTheme2) => ({
  body: css({
    minWidth: 300,
    whiteSpace: 'initial',
    padding: theme.spacing(1),
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    a: { color: theme.colors.text.link },
  }),
  text: css({ paddingBottom: theme.spacing(1) }),
});
