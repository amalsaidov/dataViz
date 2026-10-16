import { FrameMatcherID, type MatcherConfig, type StandardEditorProps } from '@grafana/data';
import { Combobox } from '@grafana/ui';
import React from 'react';

/**
 * The query of a layer (`filterData`), as core `FrameSelectionEditor`: a refId saved as a `byRefId` frame matcher.
 * No query gives the layer all frames. Core uses `RefIDPicker` of `@grafana/ui/internal`; this uses `Combobox`.
 * https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/editor/FrameSelectionEditor.tsx
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/inputs-combobox--docs
 */
export const GeoFrameSelectionEditor = ({ value, onChange, context, id }: StandardEditorProps<MatcherConfig>) => {
  const refIds = [...new Set(context.data.map((f) => f.refId).filter((r): r is string => !!r))];
  const saved: unknown = value?.options;
  const current = typeof saved === 'string' && saved ? saved : null;
  // Keep a saved refId that has no frame now, so the select shows it.
  if (current && !refIds.includes(current)) {
    refIds.push(current);
  }
  return (
    <Combobox<string>
      id={id}
      value={current}
      options={refIds.map((refId) => ({ value: refId, label: refId }))}
      onChange={(v) => onChange(v ? { id: FrameMatcherID.byRefId, options: v.value } : undefined)}
      placeholder="Change filter"
      isClearable
    />
  );
};
