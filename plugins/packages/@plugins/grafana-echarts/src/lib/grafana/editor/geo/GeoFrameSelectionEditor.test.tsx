import { createDataFrame, type MatcherConfig, type StandardEditorProps } from '@grafana/data';
import { render } from '@testing-library/react';
import React from 'react';
import { GeoFrameSelectionEditor } from './GeoFrameSelectionEditor';

interface SelectProps {
  value: string | null;
  options: Array<{ value: string }>;
  onChange: (v: { value?: string } | null) => void;
}
let selectProps: SelectProps | undefined;

jest.mock('@grafana/ui', () => ({
  Combobox: (props: SelectProps) => {
    selectProps = props;
    return null;
  },
}));

function renderEditor(value?: MatcherConfig) {
  const onChange = jest.fn();
  const data = ['A', 'B', 'A'].map((refId) => createDataFrame({ refId, fields: [] }));
  const props = { value, onChange, context: { data } } as unknown as StandardEditorProps<MatcherConfig>;
  render(<GeoFrameSelectionEditor {...props} />);
  return { onChange, props: selectProps! };
}

describe('GeoFrameSelectionEditor', () => {
  it('offers each refId of the panel frames once', () => {
    expect(renderEditor().props.options.map((o) => o.value)).toEqual(['A', 'B']);
  });

  it('keeps a saved refId that has no frame', () => {
    const { props } = renderEditor({ id: 'byRefId', options: 'C' });
    expect(props.value).toBe('C');
    expect(props.options.map((o) => o.value)).toEqual(['A', 'B', 'C']);
  });

  it('saves a byRefId matcher, and clears it to undefined', () => {
    const { onChange, props } = renderEditor();
    props.onChange({ value: 'B' });
    expect(onChange).toHaveBeenLastCalledWith({ id: 'byRefId', options: 'B' });
    props.onChange(null);
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });
});
