import { type StandardEditorProps } from '@grafana/data';
import { type MapLayerOptions } from '@grafana/schema';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { GeoLayersEditor } from './GeoLayersEditor';

const markers = (name: string): MapLayerOptions => ({ type: 'markers', name });

function renderEditor(value?: MapLayerOptions[]) {
  const onChange = jest.fn();
  const props = {
    value,
    onChange,
    item: { id: 'layers', path: 'layers', name: '', editor: () => null },
    context: { data: [], options: {} },
  } as unknown as StandardEditorProps<MapLayerOptions[] | undefined>;
  render(<GeoLayersEditor {...props} />);
  const names = () => screen.getAllByRole('textbox').map((e) => (e as HTMLInputElement).value);
  return { onChange, names, changed: () => (onChange.mock.calls.at(-1)?.[0] as MapLayerOptions[]).map((l) => l.name) };
}

describe('GeoLayersEditor', () => {
  it('shows the default layer for an unset option', () => {
    const { names } = renderEditor(undefined);
    expect(names()).toEqual(['Layer 1']);
  });

  it('shows the top layer first, as core', () => {
    const { names } = renderEditor([markers('a'), markers('b')]);
    expect(names()).toEqual(['b', 'a']);
  });

  it('adds a markers layer on top', () => {
    const { onChange, changed } = renderEditor([markers('Layer 1')]);
    fireEvent.click(screen.getByRole('button', { name: /add layer/i }));
    expect(changed()).toEqual(['Layer 1', 'Layer 2']);
    expect(onChange.mock.calls[0][0][1]).toMatchObject({ type: 'markers', location: { mode: 'auto' } });
  });

  it('moves a layer up and down in the draw order', () => {
    const { changed } = renderEditor([markers('a'), markers('b'), markers('c')]);
    // Rows: c, b, a. "Move up" of `a` draws it over `b`.
    fireEvent.click(screen.getAllByRole('button', { name: 'Move up' })[2]);
    expect(changed()).toEqual(['b', 'a', 'c']);
    fireEvent.click(screen.getAllByRole('button', { name: 'Move down' })[0]);
    expect(changed()).toEqual(['a', 'c', 'b']);
  });

  it('disables the moves at the ends of the list', () => {
    renderEditor([markers('a'), markers('b')]);
    const up = screen.getAllByRole('button', { name: 'Move up' });
    const down = screen.getAllByRole('button', { name: 'Move down' });
    expect([up[0], down[1]].map((b) => (b as HTMLButtonElement).disabled)).toEqual([true, true]);
    expect([up[1], down[0]].map((b) => (b as HTMLButtonElement).disabled)).toEqual([false, false]);
  });

  it('deletes a layer', () => {
    const { changed } = renderEditor([markers('a'), markers('b')]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete layer' })[0]);
    expect(changed()).toEqual(['a']);
  });

  it('renames a layer to a free name only', () => {
    const { onChange, changed, names } = renderEditor([markers('a'), markers('b')]);
    const input = screen.getByLabelText('Layer name a');
    fireEvent.change(input, { target: { value: 'b' } });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
    expect(names()).toEqual(['b', 'a']);

    fireEvent.change(input, { target: { value: ' c ' } });
    fireEvent.blur(input);
    expect(changed()).toEqual(['c', 'b']);
  });
});
