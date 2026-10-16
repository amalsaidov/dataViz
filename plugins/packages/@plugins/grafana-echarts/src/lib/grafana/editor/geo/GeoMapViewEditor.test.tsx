import { type StandardEditorProps } from '@grafana/data';
import { type MapViewConfig } from '@grafana/schema/dist/esm/raw/composable/geomap/panelcfg/x/GeomapPanelCfg_types.gen';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { type GeoInstanceState } from 'lib/grafana/geo/view';
import { GeoMapViewEditor } from './GeoMapViewEditor';

let comboboxChange: ((o: { value: string } | null) => void) | undefined;

// The real inline fields and inputs, and a stand-in for the Combobox: it needs a canvas to measure text.
jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  Combobox: (props: { onChange: (o: { value: string } | null) => void }) => {
    comboboxChange = props.onChange;
    return null;
  },
}));

function renderEditor(value?: MapViewConfig, instanceState?: GeoInstanceState) {
  const onChange = jest.fn();
  const props = {
    value,
    onChange,
    context: { data: [], instanceState },
  } as unknown as StandardEditorProps<MapViewConfig>;
  render(<GeoMapViewEditor {...props} />);
  return onChange;
}

const inputs = () => screen.getAllByRole('spinbutton').map((e) => e.getAttribute('aria-label'));

describe('GeoMapViewEditor', () => {
  it('shows lat and lon only for Coordinates', () => {
    renderEditor({ id: 'coords', lat: 1, lon: 2 });
    expect(inputs()).toEqual(['Latitude', 'Longitude', 'Zoom', 'Min zoom', 'Max zoom limit']);
  });

  it('shows the padding only for Fit to data', () => {
    renderEditor({ id: 'fit' });
    expect(inputs()).toEqual(['Padding', 'Zoom', 'Min zoom', 'Max zoom limit']);
    expect(screen.getByText('Max Zoom')).toBeInTheDocument();
  });

  it('writes the full view on a preset change and on an input change', () => {
    const onChange = renderEditor({ id: 'zero', lat: 0, lon: 0, zoom: 1, minZoom: 2 });
    comboboxChange!({ value: 'europe' });
    expect(onChange).toHaveBeenLastCalledWith({ id: 'europe', lat: 46, lon: 14, zoom: 4, minZoom: 2 });
    const zoom = screen.getByLabelText('Zoom');
    fireEvent.change(zoom, { target: { value: '6' } });
    fireEvent.blur(zoom);
    expect(onChange).toHaveBeenLastCalledWith({ id: 'zero', lat: 0, lon: 0, zoom: 6, minZoom: 2 });
  });

  it('saves the live view of the panel on "Use current map settings"', () => {
    const onChange = renderEditor(
      { id: 'europe', lat: 46, lon: 14, zoom: 4 },
      { readMapView: () => ({ lon: 10, lat: 20, zoom: 5.5 }) }
    );
    fireEvent.click(screen.getByRole('button', { name: 'Use current map settings' }));
    expect(onChange).toHaveBeenLastCalledWith({ id: 'coords', lat: 20, lon: 10, zoom: 5.5 });
  });
});
