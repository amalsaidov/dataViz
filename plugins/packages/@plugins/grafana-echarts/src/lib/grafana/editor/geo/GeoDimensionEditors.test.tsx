import { createDataFrame, type DataFrame, FieldType, type StandardEditorProps } from '@grafana/data';
import { ScalarDimensionMode, TextDimensionMode } from '@grafana/schema';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { GeoColorDimensionEditor } from './GeoColorDimensionEditor';
import { GeoScalarDimensionEditor } from './GeoScalarDimensionEditor';
import { GeoScaleDimensionEditor, type ScaleEditorSettings } from './GeoScaleDimensionEditor';
import { GeoTextDimensionEditor } from './GeoTextDimensionEditor';
import { clampFixed, validateScale } from './numberRange';

interface ComboProps {
  'aria-label': string;
  value: string | null;
  options: Array<{ value: string; label: string }>;
  onChange: (v: { value: string }) => void;
}

// A native select in place of the Combobox, so a test reads the options and picks one.
jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  Combobox: ({ options, value, onChange, ...rest }: ComboProps) => (
    <select aria-label={rest['aria-label']} value={value ?? ''} onChange={(e) => onChange({ value: e.target.value })}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));

const FRAMES: DataFrame[] = [
  createDataFrame({
    fields: [
      { name: 'name', type: FieldType.string, values: ['a'] },
      { name: 'value', type: FieldType.number, values: [1] },
    ],
  }),
];

function renderEditor<T>(
  Editor: React.ComponentType<StandardEditorProps<T, ScaleEditorSettings>>,
  value: NoInfer<T>,
  settings?: ScaleEditorSettings
) {
  const onChange = jest.fn();
  const props = {
    value,
    onChange,
    item: { id: 'x', path: 'x', name: '', editor: () => null, settings },
    context: { data: FRAMES, options: {} },
  } as unknown as StandardEditorProps<T>;
  render(<Editor {...props} />);
  return onChange;
}

/** The option labels of a field select. */
function optionLabels(label: string) {
  return [...screen.getByLabelText<HTMLSelectElement>(label).options].map((o) => o.label);
}

/** Pick an option of a field select. */
function pick(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
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

describe('validateScale', () => {
  const range = { min: 1, max: 100 };

  it('gives an unset min and max the range, and a fixed value in the middle, as core', () => {
    expect(validateScale({}, range)).toEqual({ min: 1, max: 100, fixed: 50.5 });
  });

  it('changes the places of a min above the max, and keeps the limits in the range', () => {
    expect(validateScale({ field: 'value', min: 500, max: 0, fixed: 5 }, range)).toEqual({
      field: 'value',
      min: 1,
      max: 100,
      fixed: 5,
    });
  });

  it('keeps a fixed value in the range only in the fixed mode, as core', () => {
    expect(validateScale({ fixed: 200, min: 2, max: 15 }, range).fixed).toBe(100);
    expect(validateScale({ field: 'value', fixed: 200, min: 2, max: 15 }, range).fixed).toBe(200);
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

  it('lists Fixed value and each field, as core', () => {
    renderEditor(GeoScaleDimensionEditor, undefined, { min: 1, max: 100 });
    expect(optionLabels('Size field')).toEqual(['Fixed value', 'name', 'value']);
  });

  it('binds the size to a field, and keeps the min and max', () => {
    const onChange = renderEditor(GeoScaleDimensionEditor, { fixed: 5, min: 2, max: 15 }, { min: 1, max: 100 });
    pick('Size field', 'value');
    expect(onChange).toHaveBeenCalledWith({ field: 'value', fixed: 5, min: 2, max: 15 });
  });

  it('shows the min and max of a size from a field, and no fixed value', () => {
    renderEditor(GeoScaleDimensionEditor, { field: 'value', fixed: 5, min: 2, max: 15 }, { min: 1, max: 100 });
    expect(screen.getByLabelText<HTMLSelectElement>('Size field').value).toBe('value');
    expect(screen.getByLabelText<HTMLInputElement>('Size min').value).toBe('2');
    expect(screen.getByLabelText<HTMLInputElement>('Size max').value).toBe('15');
    expect(screen.queryByLabelText('Size value')).toBeNull();
  });

  it('writes the max, and changes the places of a max below the min', () => {
    const onChange = renderEditor(
      GeoScaleDimensionEditor,
      { field: 'value', fixed: 5, min: 20, max: 30 },
      { min: 1, max: 100 }
    );
    commit('Size max', '10');
    expect(onChange).toHaveBeenCalledWith({ field: 'value', fixed: 5, min: 10, max: 20 });
  });

  it('names the heatmap weight, and hides the min and max of a weight field, as core hideRange', () => {
    const settings = { min: 0, max: 1, label: 'Weight', hideRange: true };
    renderEditor(GeoScaleDimensionEditor, { field: 'value', fixed: 1, min: 0, max: 1 }, settings);
    expect(screen.getByLabelText('Weight field')).toBeInTheDocument();
    expect(screen.queryByLabelText('Weight min')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Weight max')).not.toBeInTheDocument();
  });

  it('goes back to the fixed value', () => {
    const onChange = renderEditor(GeoScaleDimensionEditor, { field: 'value', fixed: 5, min: 2, max: 15 });
    pick('Size field', '_____fixed_____');
    expect(onChange).toHaveBeenCalledWith({ field: undefined, fixed: 5, min: 2, max: 15 });
  });

  it('shows a saved field that no frame has as not found', () => {
    renderEditor(GeoScaleDimensionEditor, { field: 'gone', fixed: 5, min: 2, max: 15 });
    expect(optionLabels('Size field')).toContain('gone (not found)');
  });
});

describe('GeoScalarDimensionEditor', () => {
  it('writes the fixed rotation in the range of core, and keeps the mode', () => {
    const onChange = renderEditor(GeoScalarDimensionEditor, undefined, { min: -360, max: 360 });
    expect(screen.getByLabelText<HTMLInputElement>('Rotation value').value).toBe('0');
    commit('Rotation value', '-400');
    expect(onChange).toHaveBeenCalledWith({ fixed: -360, mode: 'mod', min: -360, max: 360 });
  });

  it('lists only the number fields, as core', () => {
    renderEditor(GeoScalarDimensionEditor, undefined, { min: -360, max: 360 });
    expect(optionLabels('Rotation field')).toEqual(['Fixed value', 'value']);
  });

  it('binds the rotation to a field, and hides the fixed value', () => {
    const onChange = renderEditor(GeoScalarDimensionEditor, undefined, { min: -360, max: 360 });
    pick('Rotation field', 'value');
    expect(onChange).toHaveBeenCalledWith({ field: 'value', fixed: 0, mode: 'mod', min: -360, max: 360 });
  });

  it('writes the Clamped limit', () => {
    const onChange = renderEditor(GeoScalarDimensionEditor, {
      field: 'value',
      fixed: 0,
      mode: ScalarDimensionMode.Mod,
      min: -360,
      max: 360,
    });
    expect(screen.queryByLabelText('Rotation value')).toBeNull();
    fireEvent.click(screen.getByLabelText('Clamped'));
    expect(onChange).toHaveBeenCalledWith({ field: 'value', fixed: 0, mode: 'clamped', min: -360, max: 360 });
  });
});

describe('GeoColorDimensionEditor', () => {
  it('shows the field of a color from a field, and no color picker', () => {
    renderEditor(GeoColorDimensionEditor, { field: 'value', fixed: 'red' });
    expect(screen.getByLabelText<HTMLSelectElement>('Color field').value).toBe('value');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows Fixed color and a color picker for a fixed color', () => {
    renderEditor(GeoColorDimensionEditor, { fixed: 'red' });
    expect(optionLabels('Color field')).toEqual(['Fixed color', 'name', 'value']);
    expect(screen.getByLabelText<HTMLSelectElement>('Color field').value).toBe('_____fixed_____');
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('binds the color to a field, and keeps the fixed color', () => {
    const onChange = renderEditor(GeoColorDimensionEditor, undefined);
    pick('Color field', 'value');
    expect(onChange).toHaveBeenCalledWith({ field: 'value', fixed: 'dark-green' });
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

  it('changes the source to Field, and keeps the fixed text', () => {
    const onChange = renderEditor(GeoTextDimensionEditor, { mode: TextDimensionMode.Fixed, fixed: 'Hello' });
    fireEvent.click(screen.getByLabelText('Field'));
    expect(onChange).toHaveBeenCalledWith({ mode: TextDimensionMode.Field, fixed: 'Hello' });
  });

  it('lists each field with no fixed option, and writes the field of a text from a field', () => {
    const onChange = renderEditor(GeoTextDimensionEditor, { mode: TextDimensionMode.Field, fixed: '' });
    expect(optionLabels('Text label field')).toEqual(['name', 'value']);
    expect(screen.queryByLabelText('Text label value')).toBeNull();
    pick('Text label field', 'name');
    expect(onChange).toHaveBeenCalledWith({ mode: TextDimensionMode.Field, field: 'name', fixed: '' });
  });
});
