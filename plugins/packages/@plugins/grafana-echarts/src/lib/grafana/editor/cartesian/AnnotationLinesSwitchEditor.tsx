import { type StandardEditorProps } from '@grafana/data';
import { type VizAnnotations } from '@grafana/schema';
import { Switch } from '@grafana/ui';
import React from 'react';

// The core "Hide lines and areas" switch. It writes the line width and the band opacity together:
// the core defaults to show, 0 to hide. A copy of core `CanvasControlsSwitchEditor`
// (public/app/features/panel/options/builder/CanvasControlsSwitchEditor.tsx), which plugins cannot import.
// https://grafana.com/developers/plugin-tools/how-to-guides/panel-plugins/custom-panel-option-editors

const SHOWN: VizAnnotations = { lines: { width: 2 }, regions: { opacity: 0.1 } };
const HIDDEN: VizAnnotations = { lines: { width: 0 }, regions: { opacity: 0 } };

export function AnnotationLinesSwitchEditor({ value, onChange, id }: StandardEditorProps<VizAnnotations | undefined>) {
  // The editor owns the whole `annotations` object, so keep `clustering` and `multiLane`.
  const toggle = (hide: boolean) => onChange({ ...value, ...(hide ? HIDDEN : SHOWN) });
  return <Switch id={id} value={isHidden(value)} onChange={(event) => toggle(event.currentTarget.checked)} />;
}

/** As core: with no width and no opacity, multi-lane hides the lines. Else both must be more than 0. */
export function isHidden(options: VizAnnotations | undefined): boolean {
  if (options?.regions === undefined && options?.lines === undefined) {
    return options?.multiLane === true;
  }
  return !(options?.regions?.opacity && options?.lines?.width);
}
