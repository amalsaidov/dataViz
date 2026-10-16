import { type StandardEditorProps } from '@grafana/data';
import { RadioButtonGroup, Stack } from '@grafana/ui';
import React from 'react';
import { type HeatmapYBucketScale } from 'types';

type ScaleChoice = 'auto' | 'linear' | 'log';

/** `allowAuto` adds core's "Auto" choice, which is stored as `undefined`. */
export interface ScaleEditorSettings {
  allowAuto?: boolean;
}

/**
 * Scale radio plus a log base radio, like core Grafana's `YBucketScaleEditor`.
 * "Auto" writes `undefined`, not `{ type: 'auto' }`, so a panel switched back to
 * core reads it as auto too. Linear is the choice shown for an unset value
 * when "Auto" is not offered, which matches core's calculation default.
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/inputs-radiobuttongroup--docs
 */
export function ScaleEditor({
  value,
  onChange,
  item,
}: StandardEditorProps<HeatmapYBucketScale | undefined, ScaleEditorSettings>) {
  const allowAuto = item.settings?.allowAuto === true;
  const log = value?.log ?? 2;
  const current: ScaleChoice =
    value?.type === 'log' ? 'log' : value?.type === 'linear' || !allowAuto ? 'linear' : 'auto';

  const choices: Array<{ label: string; value: ScaleChoice }> = [
    ...(allowAuto ? [{ label: 'Auto', value: 'auto' as const }] : []),
    { label: 'Linear', value: 'linear' },
    { label: 'Log', value: 'log' },
  ];

  const onScale = (choice: ScaleChoice) => {
    if (choice === 'auto') {
      onChange(undefined);
    } else {
      onChange(choice === 'log' ? { type: 'log', log } : { type: 'linear' });
    }
  };

  return (
    <Stack direction="row" gap={1}>
      <RadioButtonGroup value={current} options={choices} onChange={onScale} />
      {current === 'log' && (
        <RadioButtonGroup
          value={log}
          options={[
            { label: '2', value: 2 },
            { label: '10', value: 10 },
          ]}
          onChange={(base) => onChange({ type: 'log', log: base })}
        />
      )}
    </Stack>
  );
}
