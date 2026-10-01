import { Component, type ReactNode } from 'react';

interface ChartErrorBoundaryProps {
  /** A change of one value clears the error, so the next data or options can render. */
  resetKeys: readonly unknown[];
  /** Called one time for each error that a child throws while it renders. */
  onError: (error: Error) => void;
  /** The view in place of the children after an error. */
  fallback: (error: Error) => ReactNode;
  children: ReactNode;
}

interface ChartErrorBoundaryState {
  error?: Error;
  resetKeys: readonly unknown[];
}

/**
 * Shows `fallback` in place of children that throw while they render. Without it, the error goes to the host.
 * https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
 */
export class ChartErrorBoundary extends Component<ChartErrorBoundaryProps, ChartErrorBoundaryState> {
  state: ChartErrorBoundaryState = { resetKeys: this.props.resetKeys };

  static getDerivedStateFromError(error: Error): Partial<ChartErrorBoundaryState> {
    return { error };
  }

  // https://react.dev/reference/react/Component#static-getderivedstatefromprops
  static getDerivedStateFromProps(
    props: ChartErrorBoundaryProps,
    state: ChartErrorBoundaryState
  ): Partial<ChartErrorBoundaryState> | null {
    const same =
      props.resetKeys.length === state.resetKeys.length &&
      props.resetKeys.every((key, index) => Object.is(key, state.resetKeys[index]));
    return same ? null : { error: undefined, resetKeys: props.resetKeys };
  }

  componentDidCatch(error: Error) {
    this.props.onError(error);
  }

  render() {
    return this.state.error === undefined ? this.props.children : this.props.fallback(this.state.error);
  }
}
