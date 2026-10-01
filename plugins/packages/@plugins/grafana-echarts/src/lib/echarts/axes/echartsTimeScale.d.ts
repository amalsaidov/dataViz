// The part of the ECharts time scale module that `timeXTicks.ts` uses. ECharts ships the module without a
// declaration file next to it. The full types are in `echarts/types/src/scale/Time.d.ts`.
// https://github.com/apache/echarts/blob/master/src/scale/Time.ts
declare module 'echarts/lib/scale/Time' {
  import type { ScaleTick } from 'echarts/types/src/util/types';

  export default class TimeScale {
    constructor(setting: { useUTC: boolean });
    setExtent(start: number, end: number): void;
    getTicks(): ScaleTick[];
  }
  export function calcNiceForTimeScale(scale: TimeScale, opt: { splitNumber?: number }): void;
}
