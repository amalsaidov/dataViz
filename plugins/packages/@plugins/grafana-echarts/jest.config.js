// force timezone to UTC to allow tests to work regardless of local timezone
// generally used by snapshots, but can affect specific tests
process.env.TZ = 'UTC';

const { grafanaESModules, nodeModulesToTransform } = require('./.config/jest/utils');

module.exports = {
  // Jest configuration provided by Grafana scaffolding
  ...require('./.config/jest.config'),
  // Jest must transform these ESM-only packages:
  // - echarts, zrender, tslib: the modular ECharts subpaths (echarts/core, /charts, ...).
  // - @react-hookz/web and its @ver0/deep-equal: dependencies of @grafana/ui 13.2.
  transformIgnorePatterns: [
    nodeModulesToTransform([
      ...grafanaESModules,
      'echarts',
      'zrender',
      'tslib',
      '@react-hookz/web',
      '@ver0/deep-equal',
    ]),
  ],
  transform: {
    '^.+\\.(t|j)sx?$': [
      '@swc/jest',
      {
        // Emit inline source maps so Jest reports failures against the original
        // .ts/.tsx source instead of the SWC-compiled output. Mirrors the
        // scaffolded .config/jest.config.js, which this transform block replaces.
        sourceMaps: 'inline',
        jsc: {
          parser: {
            syntax: 'typescript',
            tsx: true,
            decorators: false,
            dynamicImport: true,
          },
          transform: {
            hidden: {
              jest: true,
            },
          },
        },
        module: {
          type: 'commonjs',
        },
      },
    ],
  },
};
