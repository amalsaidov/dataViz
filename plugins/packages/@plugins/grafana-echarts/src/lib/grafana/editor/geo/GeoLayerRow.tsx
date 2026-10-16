import { IconButton, Input, Stack, Text } from '@grafana/ui';
import React, { useState } from 'react';

interface Props {
  name: string;
  type: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** True when no other layer has the name. */
  isNameFree: (name: string) => boolean;
  onRename: (name: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}

/**
 * One layer of the layers editor: the name (edit it in place), the type, and the move and delete buttons.
 * The list gives each row a key of the layer name, so a new name gives a new row with a new draft.
 * Core: `LayerDragDropList` in https://github.com/grafana/grafana/tree/main/public/app/core/components/Layers
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/inputs-input--docs
 */
export const GeoLayerRow = ({
  name,
  type,
  canMoveUp,
  canMoveDown,
  isNameFree,
  onRename,
  onMoveUp,
  onMoveDown,
  onDelete,
}: Props) => {
  const [draft, setDraft] = useState(name);
  const trimmed = draft.trim();
  const invalid = trimmed !== name && (!trimmed || !isNameFree(trimmed));

  // Save a valid new name; else show the saved name again.
  const commit = () => {
    if (!invalid && trimmed !== name) {
      onRename(trimmed);
    } else {
      setDraft(name);
    }
  };

  return (
    <Stack direction="row" alignItems="center" gap={1}>
      <Input
        aria-label={`Layer name ${name}`}
        value={draft}
        invalid={invalid}
        title={invalid ? 'The layer name must be unique and not empty' : undefined}
        onChange={(e) => setDraft(e.currentTarget.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      <Text color="secondary" variant="bodySmall">
        {type}
      </Text>
      <IconButton name="arrow-up" tooltip="Move up" disabled={!canMoveUp} onClick={onMoveUp} />
      <IconButton name="arrow-down" tooltip="Move down" disabled={!canMoveDown} onClick={onMoveDown} />
      <IconButton name="trash-alt" tooltip="Delete layer" onClick={onDelete} />
    </Stack>
  );
};
