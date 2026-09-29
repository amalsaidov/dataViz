import { TOOLTIP_OFFSET } from './constants';
import { type TooltipAnchor } from './types';

/**
 * Room core reserves for its window-edge math: `TooltipPlugin2` subtracts a
 * scrollbar's width from the viewport before deciding whether to flip.
 */
const SCROLLBAR_WIDTH = 16;

/**
 * Position a tooltip or an editor beside the cursor like core's `TooltipPlugin2`: offset by
 * `TOOLTIP_OFFSET`, and when it would overflow the viewport (minus a scrollbar's
 * width), flip to the cursor's other side via `translate(-100%)`.
 */
export function cursorTransform(position: { x: number; y: number }, size: { width: number; height: number }): string {
  const winWid = window.innerWidth - SCROLLBAR_WIDTH;
  const winHgt = window.innerHeight - SCROLLBAR_WIDTH;
  const width = size.width + TOOLTIP_OFFSET.x;
  const height = size.height + TOOLTIP_OFFSET.y;

  const flipX = position.x + width > winWid && position.x - width >= 0;
  const flipY = position.y + height > winHgt && position.y - height >= 0;

  const shiftX = position.x + (flipX ? -TOOLTIP_OFFSET.x : TOOLTIP_OFFSET.x);
  const shiftY = position.y + (flipY ? -TOOLTIP_OFFSET.y : TOOLTIP_OFFSET.y);
  const reflectX = flipX ? ' translateX(-100%)' : '';
  const reflectY = flipY ? ' translateY(-100%)' : '';

  return `translateX(${shiftX}px)${reflectX} translateY(${shiftY}px)${reflectY}`;
}

/**
 * Position a tooltip under an anchor box like core `AnnotationMarker`: floating-ui `bottom`
 * placement with the `shift` and `flip` middleware of `floatingUtils.getPositioningMiddleware`.
 * The tooltip is centered under the box and moved on x to stay in the viewport. When it does
 * not fit under the box, it goes above the box.
 * https://floating-ui.com/docs/tutorial#placements
 * https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/utils/floating.ts
 */
export function anchorTransform(anchor: TooltipAnchor, size: { width: number; height: number }): string {
  const winWid = window.innerWidth - SCROLLBAR_WIDTH;
  const winHgt = window.innerHeight - SCROLLBAR_WIDTH;
  const centered = anchor.x + (anchor.width - size.width) / 2;
  const x = Math.max(0, Math.min(centered, winWid - size.width));
  const below = anchor.y + anchor.height;
  const flipY = below + size.height > winHgt && anchor.y - size.height >= 0;
  const y = flipY ? anchor.y - size.height : below;
  return `translateX(${x}px) translateY(${y}px)`;
}
