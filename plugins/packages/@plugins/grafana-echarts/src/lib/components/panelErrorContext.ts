import { createContext } from 'react';

/**
 * Tells a host that the panel shows its own error view in place of the chart: the message when the view shows,
 * and `null` when the view goes. The standalone renderer sets `data-viz-state` from it (viz contract 4.4, row 8).
 */
export type PanelErrorSignal = (message: string | null) => void;

/** The signal of the host. Grafana gives no signal, so the default does nothing. */
export const PanelErrorContext = createContext<PanelErrorSignal>(() => {});
