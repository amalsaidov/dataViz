import { act, render, screen } from '@testing-library/react';
import { searchAnnotationTags } from 'lib/grafana/annotationTags';
import React, { useContext } from 'react';
import { AnnotationTagsContext } from './annotations/annotationTagsContext';
import { makeLazyPanel } from './LazyPanel';

// Stand in for the heavy Panel chunk; the tests are about when it first renders and what it gets.
let mockReceivedTagSearch: unknown;
jest.mock('lib/components/Panel', () => ({
  Panel: function MockPanel() {
    mockReceivedTagSearch = useContext(AnnotationTagsContext);
    return <div>panel</div>;
  },
}));

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

  it('gives the panel the tag search of the Grafana API', async () => {
    const LazyPanel = makeLazyPanel('cartesian');
    render(<LazyPanel {...({} as React.ComponentProps<typeof LazyPanel>)} />);
    expect(await screen.findByText('panel')).toBeInTheDocument();
    expect(mockReceivedTagSearch).toBe(searchAnnotationTags);
  });
});
