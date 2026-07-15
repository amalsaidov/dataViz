/**
 * Shared types for Grafana Workspace plugins
 */

export interface PluginConfig {
	apiUrl?: string;
	debug?: boolean;
}

export interface AppSettings {
	jsonData: PluginConfig;
}
