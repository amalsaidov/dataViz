import type React from 'react';
import { AppPlugin, type AppRootProps } from '@grafana/data';
import { App } from './components/App';

const plugin = new AppPlugin().setRootPage(App as React.ComponentType<AppRootProps>);

export { plugin };
