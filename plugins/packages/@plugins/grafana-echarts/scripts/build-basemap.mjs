#!/usr/bin/env node
// Writes the geo basemap as quantized TopoJSON: `src/lib/echarts/geo/data/countries.topo.json`.
// The source is `src/lib/echarts/geo/data/countries.geojson` (see the README in that directory).
// Usage: node scripts/build-basemap.mjs
// The measured sizes of these settings are in issue #340.
// https://github.com/topojson/topojson-server https://github.com/topojson/topojson-simplify
// https://github.com/topojson/topojson-client#quantize
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { quantize } from 'topojson-client';
import { topology } from 'topojson-server';
import { presimplify, simplify } from 'topojson-simplify';

/** The TopoJSON object name. The decoder in `basemap.ts` reads the same name. */
const OBJECT_NAME = 'countries';
/** The simplification tolerance in degrees. The minimum weight is its square (a planar area in square degrees). */
const TOLERANCE_DEGREES = 0.1;
/** The grid of the positions: 1e4 steps on each axis, about 4 km at the equator. */
const QUANTIZATION = 1e4;

const dataDirectory = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib', 'echarts', 'geo', 'data');
const source = JSON.parse(readFileSync(join(dataDirectory, 'countries.geojson'), 'utf8'));

const simplified = simplify(presimplify(topology({ [OBJECT_NAME]: source })), TOLERANCE_DEGREES ** 2);
const output = JSON.stringify(quantize(simplified, QUANTIZATION));
writeFileSync(join(dataDirectory, 'countries.topo.json'), output + '\n');
console.log(`countries.topo.json: ${output.length + 1} bytes`);
