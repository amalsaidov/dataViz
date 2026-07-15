import fs from 'node:fs';
import path from 'node:path';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import ReplaceInFileWebpackPlugin from 'replace-in-file-webpack-plugin';
import webpack from 'webpack';

// Regex patterns used in webpack configuration
const TS_TSX_PATTERN = /\.[tj]sx?$/;
const CSS_PATTERN = /\.css$/;
const SASS_SCSS_PATTERN = /\.s[ac]ss$/;
const IMAGE_PATTERN = /\.(png|jpe?g|gif|svg)$/;
const FONT_PATTERN = /\.(woff|woff2|eot|ttf|otf)(\?v=\d+\.\d+\.\d+)?$/;
const BINARY_KEEP_PATTERN = /.*?_(amd64|arm(64)?)(.exe)?/;
const NODE_MODULES_PATTERN = /[\\/]node_modules[\\/]/;

export function hasReadme() {
  return fs.existsSync(path.resolve(process.cwd(), 'src', 'README.md'));
}

function hasPublicChangelog() {
  return fs.existsSync(path.resolve(process.cwd(), 'CHANGELOG.public.md'));
}

export const sharedConfig = (env, uniqueName, packageJson, pluginJson) => ({
  context: path.join(process.cwd(), 'src'),
  mode: env.production ? 'production' : 'development',
  entry: 'module.tsx',
  cache: {
    type: 'filesystem',
    compression: env.production ? 'gzip' : false,
    cacheDirectory: path.resolve(process.cwd(), 'node_modules/.webpack_cache'),
  },
  devtool: env.production ? 'source-map' : 'eval-source-map',

  externals: [
    'lodash',
    'jquery',
    'moment',
    'slate',
    'emotion',
    '@emotion/react',
    '@emotion/css',
    'prismjs',
    'slate-plain-serializer',
    '@grafana/slate-react',
    'react',
    'react-dom',
    'react-redux',
    'redux',
    'rxjs',
    'react-router',
    'd3',
    'angular',
    '@grafana/ui',
    '@grafana/runtime',
    '@grafana/data',
    // Mark legacy SDK imports as external if their name starts with the "grafana/" prefix
    ({ request }, callback) => {
      const prefix = 'grafana/';
      const hasPrefix = (request) => request.indexOf(prefix) === 0;
      const stripPrefix = (request) => request.substr(prefix.length);

      if (hasPrefix(request)) {
        return callback(undefined, stripPrefix(request));
      }

      callback();
    },
  ],

  module: {
    rules: [
      {
        test: TS_TSX_PATTERN,
        use: {
          loader: 'swc-loader',
          options: {
            jsc: {
              baseUrl: path.resolve(process.cwd(), 'src'),
              target: 'es2015',
              loose: true,
              transform: {
                react: {
                  runtime: 'automatic',
                },
              },
              parser: {
                syntax: 'typescript',
                tsx: true,
                decorators: true,
                dynamicImport: true,
                types: false,
              },
            },
          },
        },
      },
      {
        test: CSS_PATTERN,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: SASS_SCSS_PATTERN,
        use: ['style-loader', 'css-loader', 'sass-loader'],
      },
      {
        test: IMAGE_PATTERN,
        type: 'asset/resource',
        generator: {
          publicPath: `public/plugins/${pluginJson.id}/img/`,
          outputPath: 'img/',
          filename: env.production ? '[hash][ext]' : '[name][ext]',
        },
      },
      {
        test: FONT_PATTERN,
        type: 'asset/resource',
        generator: {
          publicPath: `public/plugins/${pluginJson.id}/fonts`,
          outputPath: 'fonts/',
          filename: env.production ? '[hash][ext]' : '[name][ext]',
        },
      },
    ],
  },
  output: {
    clean: {
      keep: BINARY_KEEP_PATTERN,
    },
    library: {
      type: 'amd',
    },
    path: path.resolve(process.cwd(), 'dist'),
    filename: (chunkData) =>
      chunkData.chunk.name === 'main' || chunkData.chunk.name === 'module' ? 'module.js' : 'entry-[contenthash].js',
    chunkFilename: 'chunk-[contenthash].js',
    publicPath: `/public/plugins/${uniqueName}/`,
    uniqueName,
  },
  optimization: {
    splitChunks: {
      minChunks: 2,
      maxInitialRequests: 10,
      chunks: 'all',
      cacheGroups: {
        vendors: {
          test: NODE_MODULES_PATTERN,
          filename: () => 'vendor-[contenthash].js',
          priority: -10,
        },
      },
    },
  },
  plugins: [
    new webpack.optimize.MinChunkSizePlugin({
      minChunkSize: 50_000,
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: hasReadme() ? 'README.md' : '../README.md',
          to: '.',
          force: true,
          noErrorOnMissing: true,
        },
        { from: 'plugin.json', to: '.' },
        { from: '../LICENSE', to: '.', noErrorOnMissing: true },
        {
          from: hasPublicChangelog() ? '../CHANGELOG.public.md' : '../CHANGELOG.md',
          to: './CHANGELOG.md',
          force: true,
          noErrorOnMissing: true,
        },
        { from: '**/*.json', to: '.', noErrorOnMissing: true },
        { from: '**/*.svg', to: '.', noErrorOnMissing: true },
        { from: '**/*.png', to: '.', noErrorOnMissing: true },
        { from: '**/*.html', to: '.', noErrorOnMissing: true },
        { from: 'img/**/*', to: '.', noErrorOnMissing: true },
        { from: 'libs/**/*', to: '.', noErrorOnMissing: true },
        { from: 'static/**/*', to: '.', noErrorOnMissing: true },
      ],
    }),
    new ReplaceInFileWebpackPlugin([
      {
        dir: 'dist',
        files: ['plugin.json', 'README.md'],
        rules: [
          {
            search: /\%VERSION\%/g,
            replace: packageJson.version,
          },
          {
            search: /\%TODAY\%/g,
            replace: new Date().toISOString().substring(0, 10),
          },
          {
            search: /\%PLUGIN_ID\%/g,
            replace: pluginJson.id,
          },
        ],
      },
    ]),
  ],

  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
    modules: [path.resolve(process.cwd(), 'src'), 'node_modules'],
    unsafeCache: true,
    alias: {
      '@shared/core': path.resolve(process.cwd(), '../../@shared/core/src'),
      'react/jsx-runtime': path.resolve('node_modules/react/jsx-runtime.js'),
    },
  },

  watchOptions: {
    ignored: ['**/node_modules', '**/dist', '**/.cache', '**/.*'],
    aggregateTimeout: 1000,
    poll: false,
  },
});
