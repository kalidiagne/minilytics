import { fmtAgo } from './format';

interface Ev {
  session_id: string;
  ts: number;
  type: string;
  name: string | null;
  path: string;
}
interface Pay {
  id: unknown;
  ts: number;
  amount: number;
  kind?: string;
  renewal?: number | boolean;
}
interface Sess {
  id: string;
  started_at: number;
  last_seen_at: number;
  [k: string]: any;
}

export type Step = { ts: number; type: string; name?: string | null; path?: string; dwell: number | null; pay?: Pay };
export type Item = { kind: 'visit'; n: number; s: Sess; steps: Step[] } | { kind: 'payment'; pay: Pay } | { kind: 'gap'; label: string };

/** Visits oldest first (or newest first), each with its steps in order; payments placed at their time; gaps between visits. */
export function buildTimeline(p: { sessions: Sess[]; events: Ev[]; payments: Pay[] }, newestFirst = false): Item[] {
  const sessions = [...p.sessions].sort((a, b) => a.started_at - b.started_at);
  const bySession = new Map<string, Ev[]>();
  for (const e of p.events) {
    if (!bySession.has(e.session_id)) bySession.set(e.session_id, []);
    bySession.get(e.session_id)!.push(e);
  }
  const used = new Set<unknown>();
  const visits: (Item & { kind: 'visit' })[] = sessions.map((s, i) => {
    // A payment belongs to a visit when it lands while the visit is open (or up to 30 min after, for checkout pages).
    const pays = p.payments.filter((x) => !used.has(x.id) && x.ts >= s.started_at && x.ts <= s.last_seen_at + 30 * 60_000);
    pays.forEach((x) => used.add(x.id));
    const evs = [...(bySession.get(s.id) ?? [])].sort((a, b) => a.ts - b.ts);
    const steps: Step[] = [
      ...evs.map((e) => ({ ts: e.ts, type: e.type, name: e.name, path: e.path, dwell: null as number | null })),
      ...pays.map((x) => ({ ts: x.ts, type: 'payment', dwell: null, pay: x })),
    ].sort((a, b) => a.ts - b.ts);
    // Time on a page: until the next step in the same visit. The last page has no end, so none.
    steps.forEach((st, j) => {
      if (st.type === 'pageview' && j < steps.length - 1) st.dwell = steps[j + 1].ts - st.ts;
    });
    return { kind: 'visit', n: i + 1, s, steps };
  });
  const loose: Item[] = p.payments.filter((x) => !used.has(x.id)).map((pay) => ({ kind: 'payment', pay }));
  const at = (it: Item) => (it.kind === 'visit' ? it.s.started_at : it.kind === 'payment' ? it.pay.ts : 0);
  const ordered = [...visits, ...loose].sort((a, b) => at(a) - at(b));
  const out: Item[] = [];
  ordered.forEach((it, i) => {
    if (i > 0) {
      const prev = ordered[i - 1];
      const prevEnd = prev.kind === 'visit' ? prev.s.last_seen_at : at(prev);
      const gap = at(it) - prevEnd;
      if (gap > 60 * 60_000) out.push({ kind: 'gap', label: `${fmtAgo(gap)} ${newestFirst ? 'earlier' : 'later'}` });
    }
    out.push(it);
  });
  // Steps inside a visit stay in reading order either way.
  return newestFirst ? out.reverse() : out;
}

/** 42s, 3:05, 1:02:10 */
export function fmtOffset(ms: number): string {
  const t = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  if (!h && !m) return `${sec}s`;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
}

