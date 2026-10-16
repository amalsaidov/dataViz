// Reads a capability file of capabilities/: the status of each setting of a core panel type.
// The table is JSON, not TypeScript, so that other tools can read it.
import type { ImportPanelCapability, SettingEntry, SettingStatus } from './types';

const STATUSES = new Set<unknown>(['supported', 'ignored', 'cosmetic', 'unsupported']);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStatus = (value: unknown): value is SettingStatus => STATUSES.has(value);

/** Checks the statuses only. The schema test checks the rest of the file (viz-import.schema.json). */
const isEntry = (value: unknown): value is SettingEntry =>
  isObject(value) &&
  isStatus(value.status) &&
  (value.overrideStatus === undefined || isStatus(value.overrideStatus)) &&
  (value.values === undefined || (isObject(value.values) && Object.values(value.values).every(isStatus)));

const isTable = (value: unknown): value is Record<string, SettingEntry> =>
  isObject(value) && Object.values(value).every(isEntry);

/** The capability entry of a parsed capability file. It throws for a file with a status that is not known. */
export const toCapability = (file: unknown): ImportPanelCapability => {
  if (
    isObject(file) &&
    typeof file.source === 'string' &&
    typeof file.target === 'string' &&
    isTable(file.options) &&
    isTable(file.fieldConfig)
  ) {
    return { source: file.source, target: file.target, options: file.options, fieldConfig: file.fieldConfig };
  }
  throw new Error('The capability file is not correct.');
};
