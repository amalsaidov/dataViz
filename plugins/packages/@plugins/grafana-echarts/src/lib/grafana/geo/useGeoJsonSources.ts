import { type PanelProps } from '@grafana/data';
import { type MapLayerOptions } from '@grafana/schema';
import { useEffect, useMemo, useState } from 'react';
import { type PanelOptions } from 'types';
import { type GeoJsonConfig, getGeoJsonSrcs, getLayerSrc, isGeoJsonLayer } from './geojson';
import { isGeoJsonSourceSettled, loadGeoJsonSource, resolveGeoJsonUrl } from './geojsonSource';

declare global {
  interface Window {
    /** The Grafana public path, with the CDN URL when Grafana has one. Grafana sets it. */
    __grafana_public_path__?: string;
  }
}

/**
 * The public path, as core `geojsonLayer`. With no value, `public/`: the `<base href>` of the Grafana page gives the
 * sub path. https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/#root_url
 */
const publicPath = () => window.__grafana_public_path__ || 'public/';

/**
 * Fetch a GeoJSON file, as the OpenLayers vector source of core. https://developer.mozilla.org/docs/Web/API/Fetch_API
 */
const fetchGeoJson = (src: string): Promise<unknown> =>
  fetch(resolveGeoJsonUrl(src, publicPath())).then((r) => (r.ok ? r.json() : null));

/** The layers with the template variables of each GeoJSON `config.src` replaced, as core `getTemplateSrv().replace`. */
function interpolateSrcs(layers: MapLayerOptions[] | undefined, replace: PanelProps['replaceVariables']) {
  const withSrc = (layer: MapLayerOptions<GeoJsonConfig>): MapLayerOptions => ({
    ...layer,
    config: { ...layer.config, src: replace(getLayerSrc(layer)) },
  });
  return layers?.map((layer) => (isGeoJsonLayer(layer) ? withSrc(layer) : layer));
}

/**
 * The panel options for the geo render, and a fetch of each GeoJSON file of the layers. The options have the
 * interpolated `src` of each GeoJSON layer. When a file settles, the options are a new object, so the panel draws
 * again. https://grafana.com/developers/plugin-tools/how-to-guides/panel-plugins/add-support-for-variables
 */
export function useGeoJsonSources(
  options: PanelOptions,
  replaceVariables: PanelProps['replaceVariables']
): PanelOptions {
  const [loaded, setLoaded] = useState(0);
  const layers = useMemo(() => interpolateSrcs(options.layers, replaceVariables), [options.layers, replaceVariables]);
  const srcs = getGeoJsonSrcs(layers).filter((src) => !isGeoJsonSourceSettled(src));
  const key = srcs.join('\n');
  useEffect(() => {
    let active = true;
    for (const src of key ? key.split('\n') : []) {
      loadGeoJsonSource(src, fetchGeoJson).then(() => active && setLoaded((n) => n + 1));
    }
    return () => {
      active = false;
    };
  }, [key]);
  // `loaded` gives a new object after each load.
  return useMemo(() => ({ ...options, layers }), [options, layers, loaded]); // eslint-disable-line react-hooks/exhaustive-deps
}
