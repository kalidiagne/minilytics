import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { FLAG_BURST_SQL, notBot } from '../src/worker/stats';

// Runs the real SQL against SQLite, the engine behind D1.
type S = Partial<{ duration: number; pageviews: number; goals: number; referrer: string; utm_source: string; site: string; bot: string }>;

function setup() {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE sessions (site_id TEXT, id TEXT, started_at INTEGER, duration INTEGER, pageviews INTEGER,
    goals INTEGER, referrer TEXT, utm_source TEXT)`);
  // The migration adds the column and backfills; on an empty table the backfill is a no-op.
  db.exec(readFileSync('migrations/0011_session_bot.sql', 'utf8'));
  // Mimics ingest: insert the session, then run the burst check.
  const arrive = (id: string, at: number, o: S = {}) => {
    db.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      o.site ?? 'a', id, at, o.duration ?? 0, o.pageviews ?? 1, o.goals ?? 0, o.referrer ?? null, o.utm_source ?? null, o.bot ?? null);
    db.prepare(FLAG_BURST_SQL).run(o.site ?? 'a', at);
  };
  const kept = () => db.prepare(`SELECT id FROM sessions s WHERE ${notBot()} ORDER BY id`).all().map((r) => r.id);
  const flagged = () => db.prepare(`SELECT id FROM sessions WHERE bot = 'burst' ORDER BY id`).all().map((r) => r.id);
  return { db, arrive, kept, flagged };
}

function scenario(arrive: (id: string, at: number, o?: S) => void) {
  // Three blank sessions within a minute: a burst.
  arrive('b1', 1_000_000); arrive('b2', 1_020_000); arrive('b3', 1_050_000);
  // Same minute, but each has something a person leaves behind.
  arrive('browse', 1_010_000, { pageviews: 2 });
  arrive('goal', 1_010_000, { goals: 1 });
  arrive('ref', 1_010_000, { referrer: 'news.ycombinator.com/' });
  arrive('utm', 1_010_000, { utm_source: 'chatgpt.com' });
  // A lone blank session, and blank ones more than a minute apart: quick visitors, not a burst.
  arrive('lone', 5_000_000); arrive('pair1', 9_000_000); arrive('pair2', 9_040_000); arrive('pair3', 9_070_000);
  // Bursts are counted per site.
  arrive('other1', 1_000_000, { site: 'b' }); arrive('other2', 1_000_000, { site: 'b' });
  // Datacenter visits are hidden unless they complete a goal or stay engaged 10s+ (duration is in ms).
  arrive('dc', 2_000_000, { bot: 'datacenter', pageviews: 4, duration: 1_200 });
  arrive('dcgoal', 2_000_000, { bot: 'datacenter', goals: 1 });
  arrive('dcread', 2_000_000, { bot: 'datacenter', duration: 15_000 });
}

describe('bot sessions', () => {
  it('flags blank sessions that arrive in a burst, and hides them', () => {
    const { arrive, kept, flagged } = setup();
    scenario(arrive);
    expect(flagged()).toEqual(['b1', 'b2', 'b3']);
    expect(kept()).toEqual(['browse', 'dcgoal', 'dcread', 'goal', 'lone', 'other1', 'other2', 'pair1', 'pair2', 'pair3', 'ref', 'utm']);
  });

  it('counts a burst session again once it does something', () => {
    const { db, arrive, kept } = setup();
    scenario(arrive);
    db.exec(`UPDATE sessions SET duration = 15 WHERE id = 'b2'`);
    expect(kept()).toContain('b2');
  });

  it('backfills old data the same way ingest flags new data', () => {
    const { db, arrive, flagged } = setup();
    scenario(arrive);
    const live = flagged();
    db.exec(`UPDATE sessions SET bot = NULL WHERE bot = 'burst'`);
    const sql = readFileSync('migrations/0011_session_bot.sql', 'utf8');
    db.exec(sql.slice(sql.indexOf('UPDATE')));
    expect(flagged()).toEqual(live);
  });

  it('counts as bots exactly the sessions left out of the visitor numbers', () => {
    // The dashboard's "bots filtered" count uses NOT notBot(); it must be the exact complement, with no NULL gaps.
    const { db, arrive, kept } = setup();
    scenario(arrive);
    const bots = db.prepare(`SELECT id FROM sessions s WHERE NOT ${notBot()} ORDER BY id`).all().map((r) => r.id);
    expect(bots).toEqual(['b1', 'b2', 'b3', 'dc']);
    expect(bots.length + kept().length).toBe((db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number }).n);
  });
});
