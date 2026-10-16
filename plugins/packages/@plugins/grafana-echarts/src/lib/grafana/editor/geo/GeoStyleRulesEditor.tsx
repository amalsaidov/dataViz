import { type StandardEditorProps } from '@grafana/data';
import { Button, Stack, useTheme2 } from '@grafana/ui';
import { DEFAULT_GEOJSON_RULE, type GeoJsonStyleRule } from 'lib/grafana/geo/geojson';
import React from 'react';
import { GeoStyleRuleRow } from './GeoStyleRuleRow';

/**
 * The style rules of a GeoJSON layer (`config.rules`), as core `GeomapStyleRulesEditor`. The first rule that matches
 * a feature gives its style. A new rule has a color of the theme palette. Core picks a random palette color; here it
 * is the next color, so the result is the same each time.
 * https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/editor/GeomapStyleRulesEditor.tsx
 * https://grafana.com/developers/plugin-tools/how-to-guides/panel-plugins/custom-panel-option-editors
 */
export const GeoStyleRulesEditor = ({ value, onChange }: StandardEditorProps<GeoJsonStyleRule[] | undefined>) => {
  const theme = useTheme2();
  const rules = value ?? [];
  const { palette } = theme.visualization;
  const onAdd = () =>
    onChange([
      ...rules,
      {
        ...DEFAULT_GEOJSON_RULE,
        style: { ...DEFAULT_GEOJSON_RULE.style, color: { fixed: palette[rules.length % palette.length] } },
      },
    ]);
  return (
    <Stack direction="column" gap={1}>
      {rules.map((rule, i) => (
        <GeoStyleRuleRow
          key={i}
          rule={rule}
          onChange={(next) => onChange(rules.map((r, j) => (j === i ? next : r)))}
          onDelete={() => onChange(rules.filter((_, j) => j !== i))}
        />
      ))}
      <div>
        <Button size="sm" icon="plus" variant="secondary" onClick={onAdd}>
          Add style rule
        </Button>
      </div>
    </Stack>
  );
};
