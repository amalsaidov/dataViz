import { rangeUtil, type SelectableValue, type StandardEditorProps } from '@grafana/data';
import { Input, RadioButtonGroup, Stack } from '@grafana/ui';
import React from 'react';
import { SPAN_NULLS_DEFAULT_THRESHOLD } from 'lib/grafana/editor/cartesian/SpanNullsEditor';

// The core "Disconnect values" editor: Never, or Threshold with a time input (for example `1h`). A
// copy of core `InsertNullsEditor` and `NullsThresholdInput`
// (public/app/plugins/panel/timeseries/InsertNullsEditor.tsx), which plugins cannot import.
// https://grafana.com/developers/plugin-tools/how-to-guides/panel-plugins/custom-panel-option-editors

export function InsertNullsEditor({ value, onChange }: StandardEditorProps<boolean | number | undefined>) {
  const isThreshold = typeof value === 'number';
  const options: Array<SelectableValue<boolean | number>> = [
    { label: 'Never', value: false },
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
          aria-label="Disconnect values threshold"
          placeholder="Never"
          width={10}
          // A new key resets the uncontrolled input when the value changes from outside.
          key={value}
          defaultValue={rangeUtil.secondsToHms(value / 1000)}
          prefix={<div>&gt;</div>}
          spellCheck={false}
          onBlur={(event) => update(event.currentTarget.value)}
          onKeyDown={(event) => event.key === 'Enter' && update(event.currentTarget.value)}
        />
      )}
    </Stack>
  );
}
