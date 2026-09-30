import { Input } from '@grafana/ui';
import React from 'react';

interface Props {
  field: string;
}

/**
 * The field of a dimension that the panel JSON binds to a field. The editor has fixed values only, so this
 * shows the field and does not change it. The field mode of the dimension editors replaces it (#566).
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/inputs-input--docs
 */
export const GeoDimensionField = ({ field }: Props) => (
  <Input aria-label="Field" prefix="Field" value={field} disabled title="The value comes from this field" />
);
