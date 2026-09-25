import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { makeLazyPanel } from './LazyPanel';

// Stand in for the heavy Panel chunk; the test is about when it first renders.
jest.mock('lib/components/Panel', () => ({ Panel: () => <div>panel</div> }));

describe('makeLazyPanel', () => {
  it('waits for preload before the first render', async () => {
    let finish: () => void = () => undefined;
    const preload = jest.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const LazyPanel = makeLazyPanel('heatmap', preload);

    render(<LazyPanel {...({} as React.ComponentProps<typeof LazyPanel>)} />);
    // Let the Panel chunk resolve; the preload is still pending.
    await act(async () => undefined);
    expect(preload).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('panel')).toBeNull();

    await act(async () => finish());
    expect(await screen.findByText('panel')).toBeInTheDocument();
  });

  it('renders without a preload', async () => {
    const LazyPanel = makeLazyPanel('cartesian');
    render(<LazyPanel {...({} as React.ComponentProps<typeof LazyPanel>)} />);
    expect(await screen.findByText('panel')).toBeInTheDocument();
  });
});
