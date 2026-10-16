// The field options of the field select of a dimension editor.
import { type DataFrame, getFieldDisplayName } from '@grafana/data';
import { type ComboboxOption } from '@grafana/ui';

/** The value of the first option of a field select, as core: the fixed mode, not a field. */
export const FIXED_OPTION_VALUE = '_____fixed_____';

/**
 * The fields of the frames, as core `useMatcherSelectOptions` with no base name mode: each display name, then each
 * field name that is not a display name. `fieldType` keeps only the display names of that type, as core. A current
 * name that no frame has gives a last "(not found)" option, so the select shows it.
 * Core: `useMatcherSelectOptions` and `getFrameFieldsDisplayNames` in
 * https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/MatchersUI/utils.ts
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/inputs-combobox--docs
 */
export function fieldNameOptions(
  frames: DataFrame[],
  current?: string,
  fieldType?: string
): Array<ComboboxOption<string>> {
  const display = new Map<string, string>();
  const raw = new Set<string>();
  for (const frame of frames) {
    for (const field of frame.fields) {
      const name = getFieldDisplayName(field, frame, frames);
      display.set(name, field.type);
      if (field.name && field.name !== name) {
        raw.add(field.name);
      }
    }
  }
  const options: Array<ComboboxOption<string>> = [];
  for (const [name, type] of display) {
    if (!fieldType || type === fieldType) {
      options.push({ value: name, label: name });
    }
  }
  for (const name of raw) {
    options.push({ value: name, label: `${name} (base field name)` });
  }
  if (current && !display.has(current) && !raw.has(current)) {
    options.push({ value: current, label: `${current} (not found)` });
  }
  return options;
}
