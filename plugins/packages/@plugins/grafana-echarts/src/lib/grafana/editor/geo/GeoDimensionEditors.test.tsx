import { type StandardEditorProps } from '@grafana/data';
import { TextDimensionMode } from '@grafana/schema';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { GeoColorDimensionEditor } from './GeoColorDimensionEditor';
import { GeoScalarDimensionEditor } from './GeoScalarDimensionEditor';
import { GeoScaleDimensionEditor } from './GeoScaleDimensionEditor';
import { GeoTextDimensionEditor } from './GeoTextDimensionEditor';
import { clampFixed, type NumberRange } from './numberRange';

function renderEditor<T>(
  Editor: React.ComponentType<StandardEditorProps<T, NumberRange>>,
  value: NoInfer<T>,
  settings?: NumberRange
) {
  const onChange = jest.fn();
  const props = {
    value,
    onChange,
    item: { id: 'x', path: 'x', name: '', editor: () => null, settings },
    context: { data: [], options: {} },
  } as unknown as StandardEditorProps<T>;
  render(<Editor {...props} />);
  return onChange;
}

/** Type a value in the input, then leave it. */
function commit(label: string, text: string) {
  const input = screen.getByLabelText(label);
  fireEvent.change(input, { target: { value: text } });
  fireEvent.blur(input);
}

describe('clampFixed', () => {
  it('gives the number in the range, and no number for an empty or bad text', () => {
    expect(clampFixed('7', 1, 100)).toBe(7);
    expect(clampFixed('0', 1, 100)).toBe(1);
    expect(clampFixed('500', -360, 360)).toBe(360);
    expect(clampFixed('', 1, 100)).toBeUndefined();
    expect(clampFixed('abc', 1, 100)).toBeUndefined();
  });
});

describe('GeoScaleDimensionEditor', () => {
  it('shows the default size for an unset size, as core', () => {
    renderEditor(GeoScaleDimensionEditor, undefined, { min: 1, max: 100 });
    expect(screen.getByLabelText<HTMLInputElement>('Size value').value).toBe('5');
  });

  it('writes the fixed size in the range, and keeps the min and max', () => {
    const onChange = renderEditor(GeoScaleDimensionEditor, { fixed: 5, min: 2, max: 15 }, { min: 1, max: 100 });
    commit('Size value', '250');
    expect(onChange).toHaveBeenCalledWith({ fixed: 100, min: 2, max: 15 });
  });

  it('does not write an empty value', () => {
    const onChange = renderEditor(GeoScaleDimensionEditor, { fixed: 5, min: 2, max: 15 }, { min: 1, max: 100 });
    commit('Size value', '');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows the field of a size from a field, and no fixed value', () => {
    renderEditor(GeoScaleDimensionEditor, { field: 'value', fixed: 5, min: 2, max: 15 });
    expect(screen.getByLabelText<HTMLInputElement>('Field').value).toBe('value');
    expect(screen.queryByLabelText('Size value')).toBeNull();
  });
});

describe('GeoScalarDimensionEditor', () => {
  it('writes the fixed rotation in the range of core, and keeps the mode', () => {
    const onChange = renderEditor(GeoScalarDimensionEditor, undefined, { min: -360, max: 360 });
    expect(screen.getByLabelText<HTMLInputElement>('Rotation value').value).toBe('0');
    commit('Rotation value', '-400');
    expect(onChange).toHaveBeenCalledWith({ fixed: -360, mode: 'mod', min: -360, max: 360 });
  });
});

describe('GeoColorDimensionEditor', () => {
  it('shows the field of a color from a field', () => {
    renderEditor(GeoColorDimensionEditor, { field: 'value', fixed: 'red' });
    expect(screen.getByLabelText<HTMLInputElement>('Field').value).toBe('value');
  });

  it('shows a color picker for a fixed color', () => {
    renderEditor(GeoColorDimensionEditor, { fixed: 'red' });
    expect(screen.queryByLabelText('Field')).toBeNull();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});

describe('GeoTextDimensionEditor', () => {
  it('writes a fixed text in the fixed mode', () => {
    const onChange = renderEditor(GeoTextDimensionEditor, undefined);
    commit('Text label value', 'Hello');
    expect(onChange).toHaveBeenCalledWith({ mode: TextDimensionMode.Fixed, fixed: 'Hello' });
  });

  it('clears the text', () => {
    const onChange = renderEditor(GeoTextDimensionEditor, { mode: TextDimensionMode.Fixed, fixed: 'Hello' });
    fireEvent.click(screen.getByRole('button', { name: 'Clear value' }));
    expect(onChange).toHaveBeenCalledWith({ mode: TextDimensionMode.Fixed, fixed: '' });
  });

  it('shows the field of a text from a field', () => {
    renderEditor(GeoTextDimensionEditor, { mode: TextDimensionMode.Field, field: 'name', fixed: '' });
    expect(screen.getByLabelText<HTMLInputElement>('Field').value).toBe('name');
  });
});
