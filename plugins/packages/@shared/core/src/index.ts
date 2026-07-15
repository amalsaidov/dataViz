/**
 * Shared core utilities for Grafana Workspace plugins
 */

/**
 * Simple utility to format a greeting message
 */
export function formatMessage(message: string): string {
  return `[Workspace] ${message}`;
}

/**
 * Get current timestamp
 */
export function getCurrentTimestamp(): number {
  return Date.now();
}

export * from './types';
