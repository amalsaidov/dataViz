import { type StandardEditorsRegistryItem } from '@grafana/data';
import { fireEvent, render, screen } from '@testing-library/react';
import { AnnotationLinesSwitchEditor, isHidden } from 'lib/grafana/editor/cartesian/AnnotationLinesSwitchEditor';
import React from 'react';

const renderSwitch = (value: Parameters<typeof AnnotationLinesSwitchEditor>[0]['value']) => {
  const onChange = jest.fn();
  render(
    <AnnotationLinesSwitchEditor
      id="hide-lines"
      value={value}
      onChange={onChange}
      item={{} as StandardEditorsRegistryItem}
      context={{ data: [] }}
    />
  );
  return { onChange, input: screen.getByRole('switch') };
};

describe('AnnotationLinesSwitchEditor', () => {
  it('hides the lines and the bands, and keeps the other annotation options', () => {
    const { onChange, input } = renderSwitch({ multiLane: true, lines: { width: 2 }, regions: { opacity: 0.1 } });
    fireEvent.click(input);
    expect(onChange).toHaveBeenCalledWith({ multiLane: true, lines: { width: 0 }, regions: { opacity: 0 } });
  });

  it('shows the lines and the bands at the core defaults', () => {
    const { onChange, input } = renderSwitch({ lines: { width: 0 }, regions: { opacity: 0 } });
    fireEvent.click(input);
    expect(onChange).toHaveBeenCalledWith({ lines: { width: 2 }, regions: { opacity: 0.1 } });
  });
});

describe('isHidden', () => {
  it('is off with no options, and on for multi-lane with no width and no opacity, as core', () => {
    expect(isHidden(undefined)).toBe(false);
    expect(isHidden({ multiLane: true })).toBe(true);
  });

  it('is on when the width or the opacity is 0', () => {
    expect(isHidden({ lines: { width: 2 }, regions: { opacity: 0.1 } })).toBe(false);
    expect(isHidden({ lines: { width: 0 }, regions: { opacity: 0.1 } })).toBe(true);
    expect(isHidden({ lines: { width: 2 } })).toBe(true);
  });
});
