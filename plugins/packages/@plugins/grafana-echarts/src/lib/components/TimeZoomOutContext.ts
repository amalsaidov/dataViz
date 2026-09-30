import { createContext } from 'react';

/**
 * Who handles a double click zoom out of a panel with a time axis (`useDoubleClickZoomOut`).
 * - `undefined` (no provider, the Grafana panel): the panel calls `onChangeTimeRange` with the wider range, as core.
 * - A function: the host zooms out, for example the Zoom out path of the standalone snapshot view.
 * - `null`: the host did not opt in, so a double click does nothing.
 * https://react.dev/reference/react/createContext
 */
export const TimeZoomOutContext = createContext<(() => void) | null | undefined>(undefined);
