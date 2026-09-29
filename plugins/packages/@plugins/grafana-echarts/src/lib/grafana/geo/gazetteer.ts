import countries from './data/countries.json';
import usaStates from './data/usa-states.json';

/** A WGS84 position: `[longitude, latitude]`. */
export type LonLat = [longitude: number, latitude: number];

/**
 * One row of a worldmap-style gazetteer file. Same shape as the core files
 * `public/gazetteer/{countries,usa-states}.json`:
 * https://github.com/grafana/grafana/blob/main/public/app/features/geo/gazetteer/worldmap.ts
 */
export interface WorldmapPoint {
  key?: string;
  keys?: string[];
  latitude: number;
  longitude: number;
  name?: string;
}

/** A place-name lookup table. */
export interface Gazetteer {
  /** The core path that identifies the gazetteer, as saved in a dashboard. */
  path: string;
  find: (key: string) => LonLat | undefined;
}

/**
 * Build a gazetteer from worldmap rows. A key matches by its exact text or its upper-case text, for the
 * `name`, `key` and `keys` of each row. Port of core `loadWorldmapPoints`:
 * https://github.com/grafana/grafana/blob/main/public/app/features/geo/gazetteer/worldmap.ts
 */
export function loadWorldmapPoints(path: string, data: WorldmapPoint[]): Gazetteer {
  const values = new Map<string, LonLat>();
  for (const row of data) {
    const point: LonLat = [row.longitude, row.latitude];
    for (const key of [row.name, row.key, ...(row.keys ?? [])]) {
      if (key) {
        values.set(key, point);
        values.set(key.toUpperCase(), point);
      }
    }
  }
  return {
    path,
    find: (key) => values.get(key) ?? (typeof key === 'string' ? values.get(key.toUpperCase()) : undefined),
  };
}

/** The core paths of the bundled gazetteers. The default is the countries file. */
export const COUNTRIES_GAZETTEER_PATH = 'public/gazetteer/countries.json';
export const USA_STATES_GAZETTEER_PATH = 'public/gazetteer/usa-states.json';

const bundled = new Map<string, Gazetteer>([
  [COUNTRIES_GAZETTEER_PATH, loadWorldmapPoints(COUNTRIES_GAZETTEER_PATH, countries)],
  [USA_STATES_GAZETTEER_PATH, loadWorldmapPoints(USA_STATES_GAZETTEER_PATH, usaStates)],
]);

/**
 * Return a bundled gazetteer. An empty path gives the default (countries). Returns `undefined` for a path
 * that is not bundled, for example a custom URL or `airports.geojson`. This function also accepts the build path of these files.
 */
export function getGazetteer(path?: string): Gazetteer | undefined {
  if (!path) {
    return bundled.get(COUNTRIES_GAZETTEER_PATH);
  }
  // A relative path or the Grafana build path only. An `http(s)` URL is a custom gazetteer that core fetches.
  const match = /^(?!https?:)(?:.*\/)?gazetteer\/([^/]+\.json)$/.exec(path);
  return match ? bundled.get(`public/gazetteer/${match[1]}`) : undefined;
}
