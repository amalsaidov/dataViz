import { type ECElementEvent } from 'echarts/core';
import { treemapDrillDownNodeId } from './treemapDrillDown';

const event = (seriesType: string, data: unknown) => ({ seriesType, data }) as unknown as ECElementEvent;

describe('treemapDrillDownNodeId', () => {
  it('returns the id of a treemap parent node', () => {
    expect(treemapDrillDownNodeId(event('treemap', { id: '["a"]', children: [{ name: 'b' }] }))).toBe('["a"]');
  });

  it('returns undefined for a leaf, another series type or no event', () => {
    expect(treemapDrillDownNodeId(event('treemap', { id: '["a"]' }))).toBeUndefined();
    expect(treemapDrillDownNodeId(event('treemap', { id: '["a"]', children: [] }))).toBeUndefined();
    expect(treemapDrillDownNodeId(event('sunburst', { id: '["a"]', children: [{ name: 'b' }] }))).toBeUndefined();
    expect(treemapDrillDownNodeId(undefined)).toBeUndefined();
  });
});
