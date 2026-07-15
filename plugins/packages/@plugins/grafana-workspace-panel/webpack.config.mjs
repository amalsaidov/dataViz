import webpack from 'webpack';
import { merge } from 'webpack-merge';
import packageJson from './package.json' with { type: 'json' };
import pluginJson from './src/plugin.json' with { type: 'json' };
import { sharedConfig } from '../../../.shared/webpack-shared.mjs';

export default function config(env) {
  const config = {
    entry: 'module.ts',
    plugins: [
      new webpack.EnvironmentPlugin({
        NODE_ENV: env.development ? 'development' : 'production',
        PLUGIN_ID: 'grafana-workspace-panel',
        CURRENT_VERSION: packageJson.version,
      }),
    ],
  };

  return merge(sharedConfig(env, 'grafana-workspace-panel', packageJson, pluginJson), config);
}
