import { render, screen } from '@testing-library/react';
import React from 'react';
import { GeoMarkersLegend } from './GeoMarkersLegend';

describe('GeoMarkersLegend', () => {
  it('renders nothing with no legends', () => {
    const { container } = render(<GeoMarkersLegend legends={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders the layer name and the symbol of a fixed color', () => {
    render(
      <GeoMarkersLegend
        legends={[
          { name: 'Cities', body: { kind: 'symbol', symbol: 'img/icons/marker/star.svg', color: 'red', opacity: 0.5 } },
        ]}
      />
    );

    expect(screen.getByText('Cities')).toBeInTheDocument();
    expect(screen.getByLabelText('Symbol')).toHaveStyle({ fill: 'red', opacity: '0.5' });
  });

  it('renders one item for each threshold, and the min and max of a scale', () => {
    render(
      <GeoMarkersLegend
        legends={[
          {
            name: 'A',
            body: {
              kind: 'thresholds',
              items: [
                { label: '< 80', color: 'green' },
                { label: '80+', color: 'red' },
              ],
            },
          },
          { name: 'B', body: { kind: 'scale', colors: ['green', 'red'], min: '10', max: '90' } },
        ]}
      />
    );

    expect(screen.getByText('< 80')).toBeInTheDocument();
    expect(screen.getByText('80+')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('90')).toBeInTheDocument();
  });
});
