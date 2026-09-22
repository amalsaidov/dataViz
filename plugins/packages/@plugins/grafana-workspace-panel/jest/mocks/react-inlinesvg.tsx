// @grafana/ui's Icon component fetches `/public/img/icon/<icon_name>.svg`.
// Mock react-inlinesvg so those failed fetches don't surface as console errors.

import React from 'react';

type Callback = (...args: any[]) => void;

export interface StorageItem {
  content: string;
  queue: Callback[];
  status: string;
}

export const cacheStore: { [key: string]: StorageItem } = Object.create(null);

const SVG_FILE_NAME_REGEX = /(.+)\/(.+)\.svg$/;

const InlineSVG = ({ src }: { src: string }) => {
  // testId is the file name without extension:
  // `public/img/icons/angle-double-down.svg` -> `angle-double-down`
  const testId = src.replace(SVG_FILE_NAME_REGEX, '$2');
  return <svg xmlns="http://www.w3.org/2000/svg" data-testid={testId} viewBox="0 0 24 24" />;
};

export default InlineSVG;
