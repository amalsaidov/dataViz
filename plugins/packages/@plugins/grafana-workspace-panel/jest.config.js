// Force timezone to UTC so tests behave the same regardless of local timezone.
process.env.TZ = 'UTC';

const path = require('path');

// Known nested Grafana package dependencies that ship ESM only. Jest throws
// "Cannot use import statement outside a module" if these aren't transformed.
const grafanaESModules = [
  '.pnpm', // pnpm symlinked packages
  '@grafana/schema',
  '@wojtekmaj/date-utils',
  'd3',
  'd3-color',
  'd3-force',
  'd3-interpolate',
  'd3-scale-chromatic',
  'get-user-locale',
  'marked',
  'memoize',
  'mimic-function',
  'ol',
  'react-calendar',
  'react-colorful',
  'rxjs',
  'uuid',
];

const nodeModulesToTransform = (moduleNames) => `node_modules\/(?!.*(${moduleNames.join('|')})\/.*)`;

module.exports = {
  moduleNameMapper: {
    '\\.(css|scss|sass)$': 'identity-obj-proxy',
    // @grafana/ui's Icon fetches /public/img/icon/<name>.svg; mock it so the
    // failed fetches don't spam the console.
    'react-inlinesvg': path.resolve(__dirname, 'jest', 'mocks', 'react-inlinesvg.tsx'),
    '^@shared/core$': path.resolve(__dirname, '..', '..', '@shared', 'core', 'src'),
  },
  modulePaths: ['<rootDir>/src'],
  setupFilesAfterEnv: ['<rootDir>/jest-setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.{spec,test}.{js,jsx,ts,tsx}',
  ],
  transform: {
    '^.+\\.(t|j)sx?$': [
      '@swc/jest',
      {
        sourceMaps: 'inline',
        jsc: {
          parser: { syntax: 'typescript', tsx: true, decorators: false, dynamicImport: true },
          // Match the automatic JSX runtime webpack uses (see
          // .shared/webpack-shared.mjs) - source files import React as a type
          // only, so the classic runtime fails with "React is not defined".
          transform: { react: { runtime: 'automatic' } },
        },
      },
    ],
  },
  transformIgnorePatterns: [nodeModulesToTransform(grafanaESModules)],
  watchPathIgnorePatterns: ['<rootDir>/node_modules', '<rootDir>/dist'],
};
