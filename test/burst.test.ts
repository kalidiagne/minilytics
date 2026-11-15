import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { notBurst } from '../src/worker/stats';

// Runs the real SQL fragment against SQLite, the engine behind D1.
describe('burst bot sessions', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE sessions (site_id TEXT, id TEXT, started_at INTEGER, duration INTEGER, pageviews INTEGER,
    goals INTEGER, referrer TEXT, utm_source TEXT)`);
  const add = (id: string, at: number, o: Partial<{ duration: number; pageviews: number; goals: number; referrer: string; utm_source: string; site: string }> = {}) =>
    db.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      o.site ?? 'a', id, at, o.duration ?? 0, o.pageviews ?? 1, o.goals ?? 0, o.referrer ?? null, o.utm_source ?? null);

  // Three blank sessions within a minute: a burst.
  add('b1', 1_000_000); add('b2', 1_020_000); add('b3', 1_050_000);
  // Same minute but each has something a person leaves behind.
  add('read', 1_010_000, { duration: 12 });
  add('browse', 1_010_000, { pageviews: 2 });
  add('goal', 1_010_000, { goals: 1 });
  add('ref', 1_010_000, { referrer: 'https://news.ycombinator.com/' });
  add('utm', 1_010_000, { utm_source: 'chatgpt.com' });
  // A lone blank session, and two blank ones a minute apart: quick visitors, not a burst.
  add('lone', 5_000_000); add('pair1', 9_000_000); add('pair2', 9_090_000);
  // Bursts are counted per site.
  add('other1', 1_000_000, { site: 'b' }); add('other2', 1_000_000, { site: 'b' });

  it('drops only blank sessions that arrive in a burst', () => {
    const kept = db.prepare(`SELECT id FROM sessions s WHERE ${notBurst()} ORDER BY id`).all().map((r) => r.id);
    expect(kept).toEqual(['browse', 'goal', 'lone', 'other1', 'other2', 'pair1', 'pair2', 'read', 'ref', 'utm']);
  });
});
