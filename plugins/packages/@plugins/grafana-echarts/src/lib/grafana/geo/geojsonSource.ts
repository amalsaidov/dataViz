// The GeoJSON files of the core GeoJSON layer (`config.src`). The geo chunk adds the bundled countries file. The
// Grafana panel entry fetches each other file (`useGeoJsonSources`). The standalone renderer fetches no file.
// Core: https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/layers/data/geojsonLayer.ts

/** A GeoJSON geometry (RFC 7946 section 3.1). https://datatracker.ietf.org/doc/html/rfc7946#section-3.1 */
export type GeoJsonGeometry =
  | { type: 'Point'; coordinates: number[] }
  | { type: 'MultiPoint' | 'LineString'; coordinates: number[][] }
  | { type: 'MultiLineString' | 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] }
  | { type: 'GeometryCollection'; geometries: GeoJsonGeometry[] };

/** A GeoJSON feature (RFC 7946 section 3.2). */
export interface GeoJsonFeature {
  type: 'Feature';
  geometry: GeoJsonGeometry | null;
  properties?: Record<string, unknown> | null;
}

/** A GeoJSON feature collection (RFC 7946 section 3.3). */
export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

/** The core default `config.src`. The geo chunk gives it from the basemap data. */
export const COUNTRIES_GEOJSON_SRC = 'public/maps/countries.geojson';

/** The GeoJSON files of core `public/maps` and `public/gazetteer`, for the URL select. */
export const PUBLIC_GEOJSON_FILES = [
  COUNTRIES_GEOJSON_SRC,
  'public/maps/usa-states.geojson',
  'public/maps/example-with-style.geojson',
  'public/gazetteer/airports.geojson',
];

/** The loaded files by URL. `null` is a file that did not load. */
const sources = new Map<string, GeoJsonFeatureCollection | null>();

/** The file of `src`. `undefined` while it is not loaded, or when it did not load. */
export const getGeoJsonSource = (src: string): GeoJsonFeatureCollection | undefined => sources.get(src) ?? undefined;

/** True when the file of `src` loaded or failed. */
export const isGeoJsonSourceSettled = (src: string): boolean => sources.has(src);

const isFeatureCollection = (data: unknown): data is GeoJsonFeatureCollection =>
  typeof data === 'object' &&
  data !== null &&
  'type' in data &&
  data.type === 'FeatureCollection' &&
  'features' in data &&
  Array.isArray(data.features);

/** Add a file that needs no fetch. Data that is not a feature collection gives a file that did not load. */
export function setGeoJsonSource(src: string, data: unknown): void {
  sources.set(src, isFeatureCollection(data) ? data : null);
}

/**
 * The URL of `src`, as core: an absolute URL is not changed. Else the path is below the Grafana public path, with no
 * `public/` prefix. `window.__grafana_public_path__` is set by Grafana; with no value, `public/`.
 */
export function resolveGeoJsonUrl(src: string, publicPath = 'public/'): string {
  return src.startsWith('http') ? src : `${publicPath}${src.replace(/^public\//, '')}`;
}

/** The fetches that did not settle, by `src`. */
const pending = new Map<string, Promise<void>>();

/**
 * Fetch the file of `src` one time. `fetchJson` gets `src` and gives the parsed JSON. A failed fetch, or a file that
 * is not a feature collection, gives `null`.
 */
export function loadGeoJsonSource(src: string, fetchJson: (src: string) => Promise<unknown>): Promise<void> {
  if (sources.has(src)) {
    return Promise.resolve();
  }
  let load = pending.get(src);
  if (!load) {
    load = fetchJson(src)
      .catch(() => null)
      .then((data) => {
        sources.set(src, isFeatureCollection(data) ? data : null);
        pending.delete(src);
      });
    pending.set(src, load);
  }
  return load;
}
