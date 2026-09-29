# Histogram editor option parity

Covers the Histogram mode of the ECharts **Cartesian** module ([../module.tsx](../module.tsx)): the `histogram`
switch, compared with the core Grafana **Histogram** panel
([`public/app/plugins/panel/histogram/module.tsx`](https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/histogram/module.tsx)).
Tested with Grafana 13.2.

## Design

The panel keeps the raw frames. At each render, it makes the buckets with the steps of core `HistogramPanel`:

1. One frame, or only heatmap frames: the chart uses the bucket fields of the data (`xMin`, `xMax`). If one of the
   two fields is not there, `getHistogramFields` of `@grafana/data` finds it from the bucket size.
2. Else, `buildHistogram` of `@grafana/data` buckets the numeric fields with the bucket options.

The user transformations of the panel run before the buckets, because Grafana gives the transformed frames to the
panel. Each bucket is one bar from its lower bound to its upper bound, on a linear x axis. The bars are an ECharts
`custom` series (`lib/echarts/options/histogram.ts`). When the switch is on, the Series type is ignored.

The provisioned dashboard `provisioning/dashboards/cartesian/cartesian-histogram-parity.json` shows each case of the
gdev Histogram dashboard next to a core Histogram twin. The tests are
`src/lib/echarts/converters/histogram.test.ts` (the buckets against `buildHistogram`),
`src/lib/components/histogram.integration.test.tsx` (the drawn bars against the core buckets) and
`src/lib/components/histogram.canvas.test.tsx`.

## Panel options

| Core Grafana option | ECharts equivalent                                                              | Status    |
| ------------------- | ------------------------------------------------------------------------------- | --------- |
| Bucket count        | `bucketCount`, given to `buildHistogram`. A value of 0 or less uses the default | Supported |
| Bucket size         | `bucketSize`, given to `buildHistogram`                                         | Supported |
| Bucket offset       | `bucketOffset`, given to `buildHistogram`                                       | Supported |
| Combine series      | `combine`: one `Count` series                                                   | Supported |
| Legend              | Legend options of the panel. The legend has no calcs                            | Partial   |
| Tooltip             | "Bucket" header with the range, and the counts. Hidden mode draws no tooltip    | Supported |

## Field config

| Core Grafana setting        | ECharts equivalent                                                              | Status        |
| --------------------------- | ------------------------------------------------------------------------------- | ------------- |
| Unit, decimals of the field | The x axis labels and the tooltip header                                        | Supported     |
| Color scheme                | Classic palette over the count fields, as core `prepConfig`                     | Supported     |
| Stacking (field)            | The panel `stacking` option: Normal and 100%. No per-field groups               | Partial       |
| Fill opacity, line width    | The panel `barFillOpacity` and `lineWidth` options                              | Partial       |
| Gradient mode               | none                                                                            | Not supported |
| Hide in area                | The legend toggle hides the bars. The hidden field still counts for the buckets | Supported     |
| Min, max (x range)          | none. The x axis spans the buckets                                              | Not supported |

## Known differences

- Core pads the count axis above the highest bar. The ECharts count axis ends at the highest bar.
- With a bucket offset, core puts the x ticks on multiples of the bucket size. ECharts starts the ticks at the
  lower bound of the first bucket.
- Buckets with names (heatmap-rows `le` buckets) need an ordinal x axis. The panel shows a data issue for them.
