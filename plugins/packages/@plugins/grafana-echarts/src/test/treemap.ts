import { type EChartsType } from 'echarts';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The global box of the tile whose label (or header) is `name`, or undefined when it is not drawn. */
export function tileBox(chart: EChartsType, name: string): Box | undefined {
  for (const el of chart.getZr().storage.getDisplayList(true)) {
    const text = el.getTextContent?.();
    if (text?.style.text === name && !el.ignore && !el.invisible) {
      const rect = el.getBoundingRect();
      const [x, y] = el.transformCoordToGlobal(rect.x, rect.y);
      const [right, bottom] = el.transformCoordToGlobal(rect.x + rect.width, rect.y + rect.height);
      if (right > x && bottom > y) {
        return { x, y, width: right - x, height: bottom - y };
      }
    }
  }
  return undefined;
}
