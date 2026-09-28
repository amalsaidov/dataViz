import { dateTimeFormat, systemDateFormats } from '@grafana/data';
import { draftFromRange, formatDraftTime, toAnnotationEvent } from 'lib/grafana/annotationDraft';

const full = (value: number) => dateTimeFormat(value, { format: systemDateFormats.fullDate, timeZone: 'utc' });

describe('draftFromRange', () => {
  it('orders the two times', () => {
    expect(draftFromRange(300, 100)).toEqual({ from: 100, to: 300 });
    expect(draftFromRange(100, 300)).toEqual({ from: 100, to: 300 });
  });
});

describe('toAnnotationEvent', () => {
  it('rounds the times to whole ms, as core', () => {
    expect(toAnnotationEvent({ from: 100.4, to: 199.6 }, { description: 'Deploy', tags: ['release'] })).toEqual({
      from: 100,
      to: 200,
      description: 'Deploy',
      tags: ['release'],
    });
  });

  it('keeps a point as equal from and to, which the dashboard saves as a point', () => {
    const event = toAnnotationEvent({ from: 100, to: 100 }, { description: 'Restart', tags: [] });
    expect(event.from).toBe(event.to);
  });
});

describe('formatDraftTime', () => {
  it('formats a point in the full date format', () => {
    expect(formatDraftTime({ from: 1609459200000, to: 1609459200000 }, 'utc')).toBe(full(1609459200000));
  });

  it('formats a region as "<start> - <end>"', () => {
    expect(formatDraftTime({ from: 1609459200000, to: 1609462800000 }, 'utc')).toBe(
      `${full(1609459200000)} - ${full(1609462800000)}`
    );
  });
});
