# Geo option parity

This file compares the options of the ECharts **Geo** module ([module.tsx](./module.tsx)) with the core Grafana
**Geomap** panel
([`public/app/plugins/panel/geomap`](https://github.com/grafana/grafana/tree/main/public/app/plugins/panel/geomap)).
The frame shapes are in [data-plane/geo.md](../../../data-plane/geo.md).
`provisioning/dashboards/geo/geo-core-parity.json` shows core Geomap and this panel side by side.

The panel reads the core option JSON. It has no editor for these options yet (#330).

## Panel options

| Core option                                  | ECharts equivalent                                                                                                             | Status        |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| Map view: presets, coords, zoom, min and max | `geo.center` and `geo.zoom` in Web Mercator ([view.ts](../../lib/echarts/geo/view.ts)). The px per degree is the same as core. | Supported     |
| Map view: Fit to data, padding               | The fit uses the drawn markers.                                                                                                | Supported     |
| Map view: shared, no repeat, layer choice    | none (#339)                                                                                                                    | Not supported |
| Basemap layer (`basemap`)                    | A vector basemap of the core `countries.geojson` in theme colors. Core draws raster tiles (#338).                              | Different     |
| Map controls (`controls`)                    | none: no zoom buttons, no mouse wheel zoom or pan (#332)                                                                       | Not supported |
| Tooltip (`tooltip`)                          | none (#332)                                                                                                                    | Not supported |

## Markers layer

| Core option                                | ECharts equivalent                                                                                                                                                                     | Status        |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Location: Auto, Coords, Geohash, Lookup    | The first `markers` layer of `layers` ([location.ts](../../lib/grafana/geo/location.ts)). An unset `layers` option gives Auto. An empty list, or no `markers` layer, gives no markers. | Supported     |
| Location: H3, WKT, geometry field          | none (#384)                                                                                                                                                                            | Not supported |
| Style: the default style                   | A circle of radius 5 in `dark-green`, fill opacity 0.4, stroke width 1 ([style.ts](../../lib/grafana/geo/style.ts))                                                                    | Supported     |
| Style: size, color, symbol, text, rotation | none: the markers always have the default style (#331)                                                                                                                                 | Not supported |
| Show legend                                | none (#332)                                                                                                                                                                            | Not supported |
| Other layers, more than one layer (#330)   | none: only the first `markers` layer is read                                                                                                                                           | Not supported |
| Filter data by query (`filterData`)        | none (#339)                                                                                                                                                                            | Not supported |

## Same behavior as core

- Only the first frame gives markers. The frame loop of the core markers layer stops after one frame
  ([markersLayer.tsx](https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/layers/data/markersLayer.tsx)).
- A second marker at the same position is not drawn
  ([markersLayer.tsx](https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/layers/data/markersLayer.tsx)).
- A row with no position gives no marker.
- A latitude above 85.05° or below -85.05° is drawn at the edge of the map, as in OpenLayers.

## Differences from core

- Core repeats the world to the left and right. This panel draws the world one time, so it moves a longitude out
  of the range -180 to 180 into that range. For example, a longitude of 400 is drawn at 40.
- After a resize, the view keeps the core zoom, as OpenLayers does. The world does not scale with the panel.
