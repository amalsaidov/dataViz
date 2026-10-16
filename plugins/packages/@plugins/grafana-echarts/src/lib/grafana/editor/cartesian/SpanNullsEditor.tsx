import { rangeUtil, type SelectableValue, type StandardEditorProps } from '@grafana/data';
import { Input, RadioButtonGroup, Stack } from '@grafana/ui';
import React from 'react';

// The core "Connect null values" editor: Never, Always, or Threshold with a time input (for example
// `1h`). A copy of core `SpanNullsEditor` and `NullsThresholdInput`
// (public/app/plugins/panel/timeseries/SpanNullsEditor.tsx), which plugins cannot import.
// https://grafana.com/developers/plugin-tools/how-to-guides/panel-plugins/custom-panel-option-editors

/** The core default threshold: 1 hour. */
export const SPAN_NULLS_DEFAULT_THRESHOLD = 3_600_000;

export function SpanNullsEditor({ value, onChange }: StandardEditorProps<boolean | number | undefined>) {
  const isThreshold = typeof value === 'number';
  const options: Array<SelectableValue<boolean | number>> = [
    { label: 'Never', value: false },
    { label: 'Always', value: true },
    { label: 'Threshold', value: isThreshold ? value : SPAN_NULLS_DEFAULT_THRESHOLD },
  ];

  // As core: a valid time span (for example `30m`) is milliseconds, other text is a number, and an
  // empty input is `false`.
  const update = (text: string) => {
    if (!text) {
      onChange(false);
      return;
    }
    onChange(rangeUtil.isValidTimeSpan(text) ? rangeUtil.intervalToMs(text) : Number(text));
  };

  return (
    <Stack wrap={true}>
      <RadioButtonGroup value={value ?? false} options={options} onChange={onChange} />
      {isThreshold && (
        <Input
          aria-label="Connect null values threshold"
          placeholder="Never"
          width={10}
          // A new key resets the uncontrolled input when the value changes from outside.
          key={value}
          defaultValue={rangeUtil.secondsToHms(value / 1000)}
          prefix={<div>&lt;</div>}
          spellCheck={false}
          onBlur={(event) => update(event.currentTarget.value)}
          onKeyDown={(event) => event.key === 'Enter' && update(event.currentTarget.value)}
        />
      )}
    </Stack>
  );
}
