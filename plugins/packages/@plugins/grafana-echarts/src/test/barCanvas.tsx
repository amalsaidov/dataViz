import { type DataFrame, type FieldConfigSource, FieldType, toDataFrame } from '@grafana/data';
import { render } from '@testing-library/react';
import { AXIS_ZLEVEL, SERIES_ZLEVEL } from 'test/canvas';
import { getAxisCanvasEvents, getComponent } from 'test/panel';
import { type PanelOptions } from 'types';

/**
 * Fixtures and draw-call readers for the cartesian bar integration suites
 * (`lib/components/integration-tests/bars/`). Each suite states one core Bar
 * chart option as drawn primitives: label texts, fills, bar rectangles, axis
 * texts. Series, axes and grid paint on separate layers, so each reader takes the
 * layer it needs.
 *
 * `editorMode: 'advanced'` is required — in Default mode
 * `applyCartesianEditorModeDefaults` resets `animation.enabled` back on and the
 * draw calls stop being deterministic.
 */

/** A recorded draw call, with the canvas transform it ran under. */
export interface BarCanvasEvent {
  type: string;
  props: Record<string, unknown>;
  transform?: number[];
}

/** A drawn bar: the `rect` of a bar path (a clip rect is followed by `clip`). */
export interface DrawnRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A drawn text and where it lands (the transform translation plus the text offset). */
export interface DrawnText {
  text: string;
  x: number;
  y: number;
  fillStyle?: string;
  font?: string;
}

/** Numeric value fields for {@link categoryFrame}. */
export interface ValueField {
  name: string;
  values: Array<number | null>;
  config?: object;
}

export const CATEGORIES = ['Q1', 'Q2', 'Q3', 'Q4'];

/** One frame: a string category column and numeric value fields. */
export const categoryFrame = (fields: ValueField[], labels: string[] = CATEGORIES): DataFrame =>
  toDataFrame({
    fields: [
      { name: 'category', type: FieldType.string, values: labels },
      ...fields.map((field) => ({ type: FieldType.number, config: {}, ...field })),
    ],
  });

/** One time frame with one value field; `hours` are after a fixed start inside the test range. */
export const timeFrame = (name: string, hours: number[], values: number[]): DataFrame => {
  const start = 1783137600000;
  return toDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: hours.map((hour) => start + hour * 60 * 60 * 1000) },
      { name, type: FieldType.number, values },
    ],
  });
};

/** Render a bar panel and read one paint of the series, axis and default (grid) layers. */
export const renderBars = async (
  frames: DataFrame[],
  options: Partial<PanelOptions> = {},
  size: { width?: number; height?: number } = {},
  fieldConfig?: FieldConfigSource
) => {
  const { container } = render(
    getComponent(
      frames,
      'bar',
      {
        zLevel: { series: SERIES_ZLEVEL, axis: AXIS_ZLEVEL },
        animation: { enabled: false },
        editorMode: 'advanced',
        ...options,
      },
      undefined,
      { ...(size.width ? { width: size.width } : {}), ...(size.height ? { height: size.height } : {}) },
      'cartesian',
      fieldConfig
    )
  );
  const events = await getAxisCanvasEvents(container);
  return {
    series: events.seriesEvents as BarCanvasEvent[],
    axis: events.axisEvents as BarCanvasEvent[],
    grid: events.defaultEvents as BarCanvasEvent[],
  };
};

/** Drawn texts with position, fill and font. */
export const drawnTexts = (events: BarCanvasEvent[]): DrawnText[] => {
  let fillStyle: string | undefined;
  let font: string | undefined;
  const texts: DrawnText[] = [];
  for (const event of events) {
    if (event.type === 'fillStyle') {
      fillStyle = String(event.props.value);
    } else if (event.type === 'font') {
      font = String(event.props.value);
    } else if (event.type === 'fillText') {
      const [, , , , tx = 0, ty = 0] = event.transform ?? [];
      texts.push({
        text: String(event.props.text),
        x: tx + Number(event.props.x),
        y: ty + Number(event.props.y),
        fillStyle,
        font,
      });
    }
  }
  return texts;
};

export const texts = (events: BarCanvasEvent[]): string[] => drawnTexts(events).map(({ text }) => text);

/** Value label texts: series-layer texts that are numbers or percentages. */
export const labelTexts = (events: BarCanvasEvent[]): string[] =>
  texts(events).filter((text) => /^-?[\d.,]+%?$/.test(text));

/** Every `fillStyle` set on the layer. */
export const fills = (events: BarCanvasEvent[]): Set<string> =>
  new Set(events.filter((event) => event.type === 'fillStyle').map((event) => String(event.props.value)));

/** Every `strokeStyle` set on the layer. */
export const strokes = (events: BarCanvasEvent[]): Set<string> =>
  new Set(events.filter((event) => event.type === 'strokeStyle').map((event) => String(event.props.value)));

/** Every `lineWidth` set on the layer. */
export const lineWidths = (events: BarCanvasEvent[]): Set<number> =>
  new Set(events.filter((event) => event.type === 'lineWidth').map((event) => Number(event.props.value)));

/** Bars drawn as plain rectangles, normalized to a positive width and height. */
export const barRects = (events: BarCanvasEvent[]): DrawnRect[] =>
  events
    .filter((event, i) => event.type === 'rect' && events[i + 1]?.type !== 'clip')
    .map((event) => {
      const { x, y, width, height } = event.props as unknown as DrawnRect;
      return {
        x: width < 0 ? x + width : x,
        y: height < 0 ? y + height : y,
        width: Math.abs(width),
        height: Math.abs(height),
      };
    });

/** Count of draw calls of one type, e.g. `arcTo` for rounded bar corners. */
export const countOf = (events: BarCanvasEvent[], type: string): number =>
  events.filter((event) => event.type === type).length;

/** `#rrggbb` to the `r, g, b` part of the `rgba(r, g, b, a)` that the canvas mock records. */
export const rgbOf = (hex: string): string => {
  const value = hex.replace('#', '').toLowerCase();
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.substring(i, i + 2), 16));
  return `${r}, ${g}, ${b}`;
};
