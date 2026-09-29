# Geo option parity

This file compares the options of the ECharts **Geo** module ([module.tsx](./module.tsx)) with the core Grafana
**Geomap** panel
([`public/app/plugins/panel/geomap`](https://github.com/grafana/grafana/tree/main/public/app/plugins/panel/geomap)).
The frame shapes are in [data-plane/geo.md](../../../data-plane/geo.md).
`provisioning/dashboards/geo/geo-core-parity.json` shows core Geomap and this panel side by side.

The panel reads the core option JSON. The editor has the layer list and the location and data options of each
markers layer. The map view, the basemap and the marker style have no editor yet (#501, #502, #500).

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

| Core option                             | ECharts equivalent                                                                                                                                                                                  | Status        |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Location: Auto, Coords, Geohash, Lookup | Each `markers` layer of `layers` ([location.ts](../../lib/grafana/geo/location.ts)). An unset `layers` option gives one layer in Auto mode. An empty list, or no `markers` layer, gives no markers. | Supported     |
| Location: H3, WKT, geometry field       | none (#384)                                                                                                                                                                                         | Not supported |
| Style: the default style                | A circle of radius 5 in `dark-green` at opacity 0.4 ([dimensions.ts](../../lib/grafana/geo/dimensions.ts)). Core WebGL applies the opacity two times, so the alpha is 0.16.                         | Supported     |
| Style: size (fixed or from a field)     | Linear from `min` to `max` over the field range. Core does not read the `quad` mode, so this panel does not either.                                                                                 | Supported     |
| Style: color (fixed or from a field)    | The field color mode: by value or mappings per row, else one color. The default mode is Thresholds, as core.                                                                                        | Supported     |
| Style: opacity                          | The alpha `opacity * opacity` on the symbol, and no stroke of another color, as core WebGL                                                                                                          | Supported     |
| Style: symbol                           | Circle, square and triangle as shapes; star, cross, x-mark and plane as the core icon paths ([symbols.ts](../../lib/echarts/geo/symbols.ts))                                                        | Supported     |
| Style: other SVG symbols                | none: a circle is drawn. Core loads the SVG file from the Grafana server (#451).                                                                                                                    | Not supported |
| Style: symbol alignment, rotation       | The offset of `size` px, turned with the symbol. The circle does not turn, as core.                                                                                                                 | Supported     |
| Style: text (fixed or from a field)     | A label at the px offset, in the marker color, under the symbols. A text and no symbol draws the text only, as core.                                                                                | Supported     |
| Style: text declutter                   | ECharts `labelLayout.hideOverlap` hides the text that overlaps. The text that it keeps can differ from OpenLayers `declutter` (#452).                                                               | Different     |
| Show legend                             | none (#332)                                                                                                                                                                                         | Not supported |
| More than one markers layer             | Each `markers` layer draws in the list order, and the last layer is on top, as core ([layers.ts](../../lib/grafana/geo/layers.ts)).                                                                 | Supported     |
| Other layer types                       | none: a layer that is not `markers` is not drawn (#333 to #337)                                                                                                                                     | Not supported |
| Filter data by query (`filterData`)     | The layer uses the frames of that query. Core ignores a query that is not in the panel. This panel ignores a query that returns no frame.                                                           | Different     |

## Editor

| Core option                               | ECharts equivalent                                                                                    | Status        |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------- |
| Map layers: add, delete, rename           | The same. A new layer is a markers layer named `Layer <n>`. A name must be unique and not empty.      | Supported     |
| Map layers: order                         | Move up and move down buttons. Core drags the layers. The top row draws on top, as core.              | Different     |
| Map layers: select a layer                | none: each markers layer has its group of options. Core shows the options of the selected layer only. | Different     |
| Layer type                                | none: an added layer is a markers layer (#333 to #337)                                                | Not supported |
| Layer: Data (`filterData`)                | A select of the refIds of the panel frames                                                            | Supported     |
| Layer: Location mode and fields           | Auto, Coords, Geohash and Lookup, with the field pickers and the gazetteer of core                    | Supported     |
| Layer: style, legend and tooltip switches | none (#500, #332)                                                                                     | Not supported |
| Map view, basemap layer, map controls     | none (#501, #502, #332)                                                                               | Not supported |

## Same behavior as core

- Only the first frame of a layer gives markers. The frame loop of the core markers layer stops after one frame
  ([markersLayer.tsx](https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/layers/data/markersLayer.tsx)).
- A second marker with the same position, color, size, text and rotation is not drawn
  ([markersLayer.tsx](https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/layers/data/markersLayer.tsx)).
- A row with no position gives no marker.
- A latitude above 85.05° or below -85.05° is drawn at the edge of the map, as in OpenLayers.

## Differences from core

- Core repeats the world to the left and right. This panel draws the world one time, so it moves a longitude out
  of the range -180 to 180 into that range. For example, a longitude of 400 is drawn at 40.
- After a resize, the view keeps the core zoom, as OpenLayers does. The world does not scale with the panel.
