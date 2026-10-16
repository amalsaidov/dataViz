import { type SelectableValue, type StandardEditorProps } from '@grafana/data';
import { type LineStyle } from '@grafana/schema';
import { Field, RadioButtonGroup, Select, Stack } from '@grafana/ui';
import React, { useId } from 'react';

// The core "Line style" editor: Solid, Dash or Dots, and a dash pattern. A copy of core `LineStyleEditor`
// (public/app/plugins/panel/timeseries/LineStyleEditor.tsx), which plugins cannot import. The core
// "Accessible" fill is behind a feature toggle and is not copied.
// https://grafana.com/developers/plugin-tools/how-to-guides/panel-plugins/custom-panel-option-editors

const toOptions = (patterns: string[]): Array<SelectableValue<string>> =>
  patterns.map((text) => ({ label: text, value: text }));

/** The core dash patterns. The first is the default. */
const DASH_OPTIONS = toOptions([
  '10, 10',
  '10, 15',
  '10, 20',
  '10, 25',
  '10, 30',
  '10, 40',
  '15, 10',
  '20, 10',
  '25, 10',
  '30, 10',
  '40, 10',
  '50, 10',
  '5, 10',
  '30, 3, 3',
]);

/** The core dot patterns. The first is the default. */
const DOT_OPTIONS = toOptions(['0, 10', '0, 20', '0, 30', '0, 40', '0, 3, 3']);

const FILL_OPTIONS: Array<SelectableValue<LineStyle['fill']>> = [
  { label: 'Solid', value: 'solid' },
  { label: 'Dash', value: 'dash' },
  { label: 'Dots', value: 'dot' },
];

/** The segment lengths of a comma or space separated text, as core. */
export function parseDashText(text: string): number[] {
  return text
    .split(/(?:,| )+/)
    .map((part) => Number.parseInt(part, 10))
    .filter((n) => !Number.isNaN(n));
}

export function LineStyleEditor({ value, onChange }: StandardEditorProps<LineStyle | undefined>) {
  const patternId = useId();
  const options = value?.fill === 'dash' ? DASH_OPTIONS : DOT_OPTIONS;
  const text = value?.dash?.length ? value.dash.join(', ') : undefined;
  const current =
    text === undefined ? options[0] : (options.find((o) => o.value === text) ?? { label: text, value: text });
  const hasPattern = value?.fill === 'dash' || value?.fill === 'dot';

  return (
    <Stack direction="column" gap={2} alignItems="flex-start">
      <RadioButtonGroup
        value={value?.fill ?? 'solid'}
        options={FILL_OPTIONS}
        onChange={(fill) => {
          // As core: a new fill gets the default pattern of the fill.
          const first = fill === 'dash' ? DASH_OPTIONS[0] : fill === 'dot' ? DOT_OPTIONS[0] : undefined;
          onChange({ fill, dash: first ? parseDashText(first.value!) : undefined });
        }}
      />
      {hasPattern && (
        <Field
          noMargin
          htmlFor={patternId}
          label="Dash pattern"
          description="Comma or space separated lengths. Example: 10, 20"
        >
          <Select
            inputId={patternId}
            allowCustomValue={true}
            options={options}
            value={current}
            width={20}
            onChange={(v) => onChange({ ...value, dash: parseDashText(v.value ?? '') })}
            formatCreateLabel={(input) => `Segments: ${parseDashText(input).join(', ')}`}
          />
        </Field>
      )}
    </Stack>
  );
}
