import { type PanelProps } from '@grafana/data';
import React, { type ComponentType } from 'react';
import { useGeoJsonSources } from 'lib/grafana/geo/useGeoJsonSources';
import { type PanelOptions } from 'types';

/**
 * The geo panel of Grafana: `Panel` with the GeoJSON files of the layers. The standalone renderer does not use this
 * component, so it fetches no GeoJSON file (#567).
 */
export const makeGeoPanel = (Panel: ComponentType<PanelProps<PanelOptions>>) => {
  const GeoPanel = (props: PanelProps<PanelOptions>) => {
    const options = useGeoJsonSources(props.options, props.replaceVariables);
    return <Panel {...props} options={options} />;
  };
  return GeoPanel;
};
