import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { type TimeZone } from '@grafana/schema';
import {
  Button,
  Field,
  IconButton,
  Portal,
  Stack,
  TagsInput,
  TextArea,
  usePanelContext,
  useStyles2,
} from '@grafana/ui';
import { cursorTransform } from 'lib/components/tooltip/placement';
import { formatDraftTime, toAnnotationEvent } from 'lib/grafana/annotationDraft';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { type PlacedAnnotationDraft } from '../hooks/useAnnotationGestures';

interface Props {
  draft: PlacedAnnotationDraft;
  timeZone?: TimeZone;
  /** Closes the editor: on save, cancel, Escape or a click out of it. */
  dismiss: () => void;
}

/** The data attribute of the editor root, for tests and browser probes. */
export const ANNOTATION_EDITOR_ATTR = 'data-echarts-annotation-editor';

/**
 * The "Add annotation" form, as core's `AnnotationEditor`: a required description and tags. Save
 * sends the event to `PanelContext.onAnnotationCreate`, and the dashboard stores it.
 *
 * Differences from core: `TagsInput` replaces core `TagFilter` (not exported, and it has no list
 * of the existing tags), and the form opens at the cursor, not under the plot.
 * https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/timeseries/plugins/annotations/AnnotationEditor.tsx
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/inputs-tagsinput--docs
 */
export const AnnotationEditor: React.FC<Props> = ({ draft, timeZone, dismiss }) => {
  const styles = useStyles2(getStyles);
  const { onAnnotationCreate } = usePanelContext();
  const rootRef = useRef<HTMLDivElement>(null);
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [invalid, setInvalid] = useState(false);
  const [saving, setSaving] = useState(false);

  // Placed as the tooltip, beside the cursor, and flipped at the window edges.
  useLayoutEffect(() => {
    const dom = rootRef.current;
    if (dom != null) {
      dom.style.transform = cursorTransform(draft.position, { width: dom.offsetWidth, height: dom.offsetHeight });
    }
  }, [draft.position]);

  // A press out of the editor or Escape closes it, as core (`useClickAway`).
  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        dismiss();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        dismiss();
      }
    };
    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [dismiss]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (description.trim() === '') {
      setInvalid(true);
      return;
    }
    setSaving(true);
    try {
      // The type says `void`, but the dashboard returns a promise; wait for it as core.
      await onAnnotationCreate?.(toAnnotationEvent(draft, { description, tags }));
      dismiss();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Portal>
      <div ref={rootRef} className={styles.editor} {...{ [ANNOTATION_EDITOR_ATTR]: '' }}>
        <div className={styles.header}>
          <Stack justifyContent="space-between" alignItems="center">
            <Stack gap={0} width="100%" justifyContent="space-between" alignItems="center">
              <div>Add annotation</div>
              <div>{formatDraftTime(draft, timeZone)}</div>
            </Stack>
            <IconButton aria-label="Close" name="times" onClick={dismiss} />
          </Stack>
        </div>
        <form onSubmit={onSubmit}>
          <div className={styles.content}>
            <Field label="Description" invalid={invalid} error={invalid ? 'Annotation description is required' : ''}>
              <TextArea
                autoFocus
                className={styles.textarea}
                value={description}
                onChange={(event) => {
                  setDescription(event.currentTarget.value);
                  setInvalid(false);
                }}
              />
            </Field>
            <Field label="Tags">
              <TagsInput placeholder="Add tags" tags={tags} onChange={setTags} />
            </Field>
          </div>
          <div className={styles.footer}>
            <Stack justifyContent="flex-end">
              <Button size="sm" variant="secondary" fill="outline" onClick={dismiss}>
                Cancel
              </Button>
              <Button size="sm" type="submit" disabled={saving}>
                {saving ? 'Saving' : 'Save'}
              </Button>
            </Stack>
          </div>
        </form>
      </div>
    </Portal>
  );
};

// Core `AnnotationEditor` styles, and fixed placement as the tooltip.
const getStyles = (theme: GrafanaTheme2) => ({
  editor: css({
    position: 'fixed',
    top: 0,
    left: 0,
    zIndex: theme.zIndex.tooltip,
    background: theme.colors.background.elevated,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z3,
    userSelect: 'text',
    width: 460,
  }),
  header: css({
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    padding: theme.spacing(0.5, 1),
    fontWeight: theme.typography.fontWeightBold,
    fontSize: theme.typography.fontSize,
    color: theme.colors.text.primary,
  }),
  content: css({
    padding: theme.spacing(1),
  }),
  footer: css({
    borderTop: `1px solid ${theme.colors.border.weak}`,
    padding: theme.spacing(1),
  }),
  textarea: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
