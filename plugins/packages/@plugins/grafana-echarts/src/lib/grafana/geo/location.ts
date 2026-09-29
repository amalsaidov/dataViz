import {
  type DataFrame,
  type Field,
  type FieldMatcher,
  FieldMatcherID,
  FieldType,
  getFieldDisplayName,
  getFieldMatcher,
} from '@grafana/data';
import { type FrameGeometrySource, FrameGeometrySourceMode } from '@grafana/schema';
import { decodeGeohash } from './geohash';
import { getGazetteer, type Gazetteer, type LonLat } from './gazetteer';

/**
 * Location matchers of the core Geomap panel, ported from
 * https://github.com/grafana/grafana/blob/main/public/app/features/geo/utils/location.ts
 * The location option is the core `FrameGeometrySource`:
 * https://github.com/grafana/grafana/blob/main/packages/grafana-schema/src/common/common.gen.ts
 *
 * Differences from core:
 * - Positions are `[lon, lat]` pairs, not OpenLayers geometries (no `ol` dependency).
 * - The gazetteer is bundled and sync. Custom gazetteer URLs are not loaded.
 * - The `h3`, `wkt` and `geo` (geometry field) matchers of core are not ported.
 * - A geohash with a character outside the geohash alphabet gives no position. Core reads it as all bits set.
 * - A gazetteer URL and `airports.geojson` are not loaded. They give the warning "Gazetteer not found".
 */

type FieldFinder = (frame: DataFrame) => Field | undefined;

function getFieldFinder(matcher: FieldMatcher): FieldFinder {
  return (frame) => frame.fields.find((field) => matcher(field, frame, []));
}

/** Match a field by its lower-case name, or by its display name. */
function matchLowerNames(names: Set<string>): FieldFinder {
  return (frame) =>
    frame.fields.find((field) => names.has(field.name.toLowerCase()) || names.has(getFieldDisplayName(field, frame)));
}

/** Field finders for one location mode. */
export interface LocationFieldMatchers {
  mode: FrameGeometrySourceMode;
  geohash: FieldFinder;
  latitude: FieldFinder;
  longitude: FieldFinder;
  lookup: FieldFinder;
  gazetteer?: Gazetteer;
}

const noField: FieldFinder = () => undefined;

const defaultMatchers: LocationFieldMatchers = {
  mode: FrameGeometrySourceMode.Auto,
  geohash: matchLowerNames(new Set(['geohash'])),
  latitude: matchLowerNames(new Set(['latitude', 'lat'])),
  longitude: matchLowerNames(new Set(['longitude', 'lon', 'lng'])),
  lookup: matchLowerNames(new Set(['lookup'])),
};

/** Build the matchers of a location option. An unset option gives the Auto matchers. */
export function getLocationMatchers(src?: FrameGeometrySource): LocationFieldMatchers {
  const info: LocationFieldMatchers = {
    ...defaultMatchers,
    mode: src?.mode ?? FrameGeometrySourceMode.Auto,
    // Always select a gazetteer (the default if unset), so a switch to Lookup mode needs no extra step.
    gazetteer: getGazetteer(src?.gazetteer),
  };
  const byName = (name: string) => getFieldFinder(getFieldMatcher({ id: FieldMatcherID.byName, options: name }));
  switch (info.mode) {
    // In manual mode, a field that is not named is not found automatically.
    case FrameGeometrySourceMode.Geohash:
      info.geohash = src?.geohash ? byName(src.geohash) : noField;
      break;
    case FrameGeometrySourceMode.Lookup:
      info.lookup = src?.lookup?.length
        ? byName(src.lookup)
        : getFieldFinder(getFieldMatcher({ id: FieldMatcherID.byType, options: FieldType.string }));
      break;
    case FrameGeometrySourceMode.Coords:
      info.latitude = src?.latitude ? byName(src.latitude) : noField;
      info.longitude = src?.longitude ? byName(src.longitude) : noField;
      break;
  }
  return info;
}

/** The fields that a frame gives for a mode. */
export interface LocationFields {
  mode: FrameGeometrySourceMode;
  geohash?: Field;
  latitude?: Field;
  longitude?: Field;
  lookup?: Field;
}

/** Find the location fields of a frame. In Auto mode, pick the first mode that matches: coords, geohash, lookup. */
export function getLocationFields(frame: DataFrame, location: LocationFieldMatchers): LocationFields {
  const fields: LocationFields = { mode: location.mode ?? FrameGeometrySourceMode.Auto };

  if (fields.mode === FrameGeometrySourceMode.Auto) {
    fields.latitude = location.latitude(frame);
    fields.longitude = location.longitude(frame);
    if (fields.latitude && fields.longitude) {
      fields.mode = FrameGeometrySourceMode.Coords;
      return fields;
    }
    fields.geohash = location.geohash(frame);
    if (fields.geohash) {
      fields.mode = FrameGeometrySourceMode.Geohash;
      return fields;
    }
    fields.lookup = location.lookup(frame);
    if (fields.lookup) {
      fields.mode = FrameGeometrySourceMode.Lookup;
      return fields;
    }
  }

  switch (fields.mode) {
    case FrameGeometrySourceMode.Coords:
      fields.latitude = location.latitude(frame);
      fields.longitude = location.longitude(frame);
      break;
    case FrameGeometrySourceMode.Geohash:
      fields.geohash = location.geohash(frame);
      break;
    case FrameGeometrySourceMode.Lookup:
      fields.lookup = location.lookup(frame);
      break;
  }
  return fields;
}

/** The position of each row of a frame. A row with no position is `undefined`. */
export interface FramePositions {
  /** One entry for each row of the frame. */
  positions?: Array<LonLat | undefined>;
  /** The reason that `positions` is missing. */
  warning?: string;
  /** The mode and fields that were used. */
  description?: string;
}

/** A finite number, or a string of one. Core passes the value to OpenLayers, which reads `"42.5"` as 42.5. */
const toCoordinate = (value: unknown): number | undefined => {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof number === 'number' && Number.isFinite(number) ? number : undefined;
};

/** Resolve the position of each row of a frame with the location matchers. Mirrors core `getGeometryField`. */
export function getFramePositions(frame: DataFrame, location: LocationFieldMatchers): FramePositions {
  const fields = getLocationFields(frame, location);
  switch (fields.mode) {
    case FrameGeometrySourceMode.Auto:
      return { warning: 'Unable to find location fields' };

    case FrameGeometrySourceMode.Coords: {
      const { latitude, longitude } = fields;
      if (!latitude || !longitude) {
        return { warning: 'Select latitude/longitude fields' };
      }
      return {
        positions: longitude.values.map((lon: unknown, row: number): LonLat | undefined => {
          const x = toCoordinate(lon);
          const y = toCoordinate(latitude.values[row]);
          // Core skips only `null`. A non-finite value has no position on a map either.
          return x != null && y != null ? [x, y] : undefined;
        }),
        description: `${fields.mode}: ${latitude.name}, ${longitude.name}`,
      };
    }

    case FrameGeometrySourceMode.Geohash:
      if (!fields.geohash) {
        return { warning: 'Select geohash field' };
      }
      return {
        positions: fields.geohash.values.map((hash: unknown) =>
          typeof hash === 'string' ? decodeGeohash(hash) : undefined
        ),
        description: fields.mode,
      };

    case FrameGeometrySourceMode.Lookup:
      if (!fields.lookup) {
        return { warning: 'Select lookup field' };
      }
      if (!location.gazetteer) {
        return { warning: 'Gazetteer not found' };
      }
      return {
        positions: fields.lookup.values.map((key: unknown) =>
          typeof key === 'string' ? location.gazetteer?.find(key) : undefined
        ),
        description: `${fields.mode}: ${location.gazetteer.path}`,
      };
  }
}
