import { describe, expect, it } from 'vitest';
import { buildTimeline, fmtOffset } from '../src/dashboard/lib/timeline';

const H = 3_600_000;
describe('visitor timeline', () => {
  it('orders visits oldest first, steps in order, payments at their time, with gaps', () => {
    const t0 = Date.UTC(2026, 10, 1, 10);
    const items = buildTimeline({
      // The API returns newest first.
      sessions: [
        { id: 's2', started_at: t0 + 72 * H, last_seen_at: t0 + 72 * H + 120_000 },
        { id: 's1', started_at: t0, last_seen_at: t0 + 90_000 },
      ],
      events: [
        { session_id: 's2', ts: t0 + 72 * H + 60_000, type: 'goal', name: 'signup', path: '/pricing' },
        { session_id: 's2', ts: t0 + 72 * H, type: 'pageview', name: null, path: '/pricing' },
        { session_id: 's1', ts: t0 + 30_000, type: 'pageview', name: null, path: '/blog' },
        { session_id: 's1', ts: t0, type: 'pageview', name: null, path: '/' },
      ],
      payments: [
        { id: 'p2', ts: t0 + 200 * H, amount: 900, renewal: 1 },
        { id: 'p1', ts: t0 + 72 * H + 90_000, amount: 900 },
      ],
    });
    expect(items.map((i) => (i.kind === 'visit' ? `visit${i.n}` : i.kind))).toEqual(['visit1', 'gap', 'visit2', 'gap', 'payment']);
    const v1 = items[0] as Extract<(typeof items)[0], { kind: 'visit' }>;
    expect(v1.steps.map((s) => [s.path, s.dwell])).toEqual([['/', 30_000], ['/blog', null]]);
    const v2 = items[2] as Extract<(typeof items)[0], { kind: 'visit' }>;
    expect(v2.steps.map((s) => s.type)).toEqual(['pageview', 'goal', 'payment']);
  });

  it('formats offsets from the visit start', () => {
    expect(fmtOffset(42_000)).toBe('42s');
    expect(fmtOffset(185_000)).toBe('3:05');
    expect(fmtOffset(3_730_000)).toBe('1:02:10');
  });
});
