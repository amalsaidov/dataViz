import { type PanelDataErrorViewProps } from '@grafana/runtime';
import React, { useContext, useEffect } from 'react';
import { PanelDataErrorViewContext } from './panelDataErrorViewContext';
import { PanelErrorContext } from './panelErrorContext';

/**
 * The error view for a data issue of the chart module (`ChartModule.getDataIssue`), in place of the chart. It shows
 * the error view of Grafana, and it gives the signal of `PanelErrorContext` when it shows and when it goes.
 * https://github.com/grafana/grafana/blob/main/packages/grafana-runtime/src/components/PanelDataErrorView.tsx
 */
export const DataIssueView = (props: PanelDataErrorViewProps & { message: string }) => {
  const signal = useContext(PanelErrorContext);
  const renderErrorView = useContext(PanelDataErrorViewContext);
  const { message } = props;
  // A new message gives only the new message. A new signal or the unmount gives `null` first.
  useEffect(() => () => signal(null), [signal]);
  useEffect(() => signal(message), [signal, message]);
  // With a `needs*` flag, Grafana gives its own text for the missing field type.
  const needsField = props.needsTimeField === true || props.needsNumberField === true;
  // Each error view sets `data-viz-state` to `error` (AGENTS.md).
  return (
    <div data-viz-state="error" style={{ width: '100%', height: '100%' }}>
      {renderErrorView({ ...props, message: needsField ? undefined : message })}
    </div>
  );
};
