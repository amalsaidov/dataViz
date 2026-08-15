// Force timezone to UTC so tests behave the same regardless of local timezone.
process.env.TZ = 'UTC';

// This package is plain TypeScript with no React or DOM usage, so it runs in
// the node environment and skips the jsdom/CSS/react-inlinesvg mapping that
// the panel plugins need.
module.exports = {
  modulePaths: ['<rootDir>/src'],
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/__tests__/**/*.{js,ts}', '<rootDir>/src/**/*.{spec,test}.{js,ts}'],
  transform: {
    '^.+\\.(t|j)sx?$': [
      '@swc/jest',
      {
        sourceMaps: 'inline',
        jsc: {
          parser: { syntax: 'typescript', tsx: false, decorators: false, dynamicImport: true },
        },
      },
    ],
  },
  watchPathIgnorePatterns: ['<rootDir>/node_modules', '<rootDir>/dist'],
};
