import { PanelDataErrorView, type PanelDataErrorViewProps } from '@grafana/runtime';
import React, { useContext, useEffect } from 'react';
import { PanelErrorContext } from './panelErrorContext';

/**
 * The error view for a data issue of the chart module (`ChartModule.getDataIssue`), in place of the chart. It shows
 * the error view of Grafana, and it gives the signal of `PanelErrorContext` when it shows and when it goes.
 * https://github.com/grafana/grafana/blob/main/packages/grafana-runtime/src/components/PanelDataErrorView.tsx
 */
export const DataIssueView = (props: PanelDataErrorViewProps & { message: string }) => {
  const signal = useContext(PanelErrorContext);
  const { message } = props;
  // A new message gives only the new message. A new signal or the unmount gives `null` first.
  useEffect(() => () => signal(null), [signal]);
  useEffect(() => signal(message), [signal, message]);
  return <PanelDataErrorView {...props} />;
};
