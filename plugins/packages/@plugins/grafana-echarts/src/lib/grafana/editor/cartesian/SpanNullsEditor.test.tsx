import { type StandardEditorsRegistryItem } from '@grafana/data';
import { fireEvent, render, screen } from '@testing-library/react';
import { SPAN_NULLS_DEFAULT_THRESHOLD, SpanNullsEditor } from 'lib/grafana/editor/cartesian/SpanNullsEditor';
import React from 'react';

const renderEditor = (value: boolean | number | undefined) => {
  const onChange = jest.fn();
  render(
    <SpanNullsEditor
      value={value}
      onChange={onChange}
      item={{} as StandardEditorsRegistryItem}
      context={{ data: [] }}
    />
  );
  return { onChange };
};

describe('SpanNullsEditor', () => {
  it('writes `true` for Always', () => {
    const never = renderEditor(false);
    fireEvent.click(screen.getByLabelText('Always'));
    expect(never.onChange).toHaveBeenLastCalledWith(true);
  });

  it('writes `false` for Never', () => {
    const always = renderEditor(true);
    fireEvent.click(screen.getByLabelText('Never'));
    expect(always.onChange).toHaveBeenLastCalledWith(false);
  });

  it('writes the core default of 1 hour for Threshold, and shows no input before', () => {
    const { onChange } = renderEditor(false);
    expect(screen.queryByLabelText('Connect null values threshold')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Threshold'));
    expect(onChange).toHaveBeenLastCalledWith(SPAN_NULLS_DEFAULT_THRESHOLD);
  });

  it('writes a time span as milliseconds, and an empty input as `false`', () => {
    const { onChange } = renderEditor(SPAN_NULLS_DEFAULT_THRESHOLD);
    const input = screen.getByLabelText('Connect null values threshold');
    expect(input).toHaveValue('1h');
    fireEvent.blur(input, { target: { value: '30m' } });
    expect(onChange).toHaveBeenLastCalledWith(1_800_000);
    fireEvent.blur(input, { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(false);
  });
});
