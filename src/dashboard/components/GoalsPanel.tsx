import { Fragment, useState } from 'react';
import { navigate } from '../App';
import { usePref } from '../lib/prefs';
import { api, qs, type BreakdownRow } from '../lib/api';
import { ConfirmButton } from './ConfirmButton';
import { displayName } from '../../shared/names';
import { useDash } from '../lib/context';
import { countryName, fmtAgo, fmtDateTime, fmtDuration, fmtNumber, fmtPct, goalName } from '../lib/format';
import { renderLabel } from './Panel';
import { useApi } from '../lib/useApi';
import { Avatar, BrowserIcon, DeviceIcon, Flag, OSIcon, SourceIcon } from './Icons';

type Tab = 'goal' | 'funnel' | 'user' | 'journey';

export function GoalsPanel({
  totalVisitors,
  prevVisitors,
  paid,
  pins,
  setPins,
}: {
  totalVisitors: number;
  prevVisitors: number;
  paid: boolean;
  pins: string[];
  setPins: (next: string[]) => void;
}) {
  const [pref, setTab] = usePref<Tab>('ml_tab_goals', 'goal');
  const [search, setSearch] = useState('');
  // Journey lists who paid; without a payment source it can only ever be empty.
  const tabs = paid ? (['goal', 'funnel', 'user', 'journey'] as const) : (['goal', 'funnel', 'user'] as const);
  const tab: Tab = !paid && pref === 'journey' ? 'goal' : pref;
  return (
    <div className="card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
        <div className="tabs">
          {tabs.map((t) => (
            <button key={t} className={`tab capitalize ${tab === t ? 'tab-active' : ''}`} onClick={() => setTab(t)}>
              {t === 'journey' ? 'Journey' : t === 'user' ? 'Users' : t === 'goal' ? 'Goals' : 'Funnel'}
            </button>
          ))}
        </div>
        {(tab === 'user' || tab === 'journey') && (
          <input className="input max-w-[240px] py-1.5" placeholder="🔍 Search" value={search} onChange={(e) => setSearch(e.target.value)} />
        )}
      </div>
      {tab === 'goal' && <Goals totalVisitors={totalVisitors} prevVisitors={prevVisitors} paid={paid} pins={pins} setPins={setPins} />}
      {tab === 'funnel' && <Funnels />}
      {tab === 'user' && <Users search={search} />}
      {tab === 'journey' && <Journey search={search} />}
    </div>
  );
}

function Goals({
  totalVisitors,
  prevVisitors,
  paid,
  pins,
  setPins,
}: {
  totalVisitors: number;
  prevVisitors: number;
  paid: boolean;
  pins: string[];
  setPins: (next: string[]) => void;
}) {
  const { site, q, reloadKey, money, addFilter } = useDash();
  const { data } = useApi<BreakdownRow[]>(`/api/sites/${site.id}/breakdown?${qs(q, { dim: 'goal' })}`, reloadKey);
  const [open, setOpen] = useState<string | null>(null);
  if (!data) return <div className="h-40 animate-pulse" />;
  if (!data.length)
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 px-2 pb-2 text-sm text-stone-600">
        <span>
          No goals fired in this period. Add <code className="rounded bg-stone-100 px-1">data-ml-goal="signup"</code> to a button.
        </span>
        <button className="font-medium hover:text-ink" onClick={() => navigate(`/site/${site.id}/settings?tab=setup&step=goals`)}>
          Set up goals →
        </button>
      </div>
    );

  // Pinned goals first, then by conversion (visitors / the same total, so by visitors).
  const rows = [...data].sort((a, b) => Number(pins.includes(b.label ?? '')) - Number(pins.includes(a.label ?? '')) || b.visitors - a.visitors);
  const best = Math.max(...rows.map((r) => r.visitors), 1);
  const togglePin = (label: string) => setPins(pins.includes(label) ? pins.filter((p) => p !== label) : [...pins, label]);
  const cols = paid ? 6 : 5;

  return (
    <div className="overflow-x-auto">
      <table className="w-full whitespace-nowrap text-sm tabular-nums">
        <thead>
          <tr className="text-left text-stone-500">
            <th className="w-8 pb-2 pl-2" aria-label="Pinned" />
            <th className="px-2 pb-2 font-medium">Goal</th>
            <th className="pb-2 pl-3 font-medium sm:w-[34%]">Conversion</th>
            <th className="pb-2 pl-3 text-right font-medium max-sm:hidden">Visitors</th>
            <th className="pb-2 pl-3 text-right font-medium max-sm:hidden">Completions</th>
            {paid && <th className="pb-2 pl-3 text-right font-medium max-sm:hidden">Revenue</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => {
            const label = g.label ?? '';
            const pinned = pins.includes(label);
            const rate = totalVisitors ? g.visitors / totalVisitors : 0;
            const perVisitor = g.visitors ? (g.pageviews ?? 0) / g.visitors : 0;
            const expanded = open === label;
            return (
              <Fragment key={label}>
                <tr
                  className="cursor-pointer border-t border-stone-100 hover:bg-stone-50"
                  onClick={() => addFilter('goal', label)}
                  title={`Filter the dashboard to visitors who completed ${label}`}
                >
                  <td className="py-2.5 pl-2">
                    <button
                      className={`flex h-7 w-7 items-center justify-center rounded-lg hover:bg-stone-100 ${pinned ? 'text-amber-700' : 'text-stone-300 hover:text-stone-500'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePin(label);
                      }}
                      aria-label={pinned ? `Unpin ${label}` : `Pin ${label} to the top`}
                      title={pinned ? 'Unpin' : 'Pin to the top and the summary'}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill={pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
                        <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" />
                      </svg>
                    </button>
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-2">
                      <button
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-stone-500 hover:bg-stone-100 hover:text-ink"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpen(expanded ? null : label);
                        }}
                        aria-expanded={expanded}
                        aria-label={`${expanded ? 'Hide' : 'Show'} where ${label} visitors came from`}
                        title="Where they came from"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`transition-transform ${expanded ? 'rotate-90' : ''}`} aria-hidden="true">
                          <path d="m9 6 6 6-6 6" />
                        </svg>
                      </button>
                      <span className="font-medium" title={label}>
                        {goalName(label)}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 pl-3">
                    <div className="flex items-center gap-3">
                      <span className="h-2 min-w-[60px] flex-1 overflow-hidden rounded-full bg-stone-100 max-sm:hidden">
                        <span className="block h-full rounded-full bg-visitors" style={{ width: `${(g.visitors / best) * 100}%` }} />
                      </span>
                      <span className="w-11 text-right font-medium sm:w-12">{totalVisitors ? fmtPct(rate, rate >= 0.1 ? 0 : 1) : '—'}</span>
                      <span className="w-12 text-left sm:w-16">
                        <RateChange cur={rate} prevVisitors={g.prevVisitors} prevTotal={prevVisitors} />
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 pl-3 text-right max-sm:hidden">{fmtNumber(g.visitors)}</td>
                  <td className="py-2.5 pl-3 text-right max-sm:hidden">
                    {fmtNumber(g.pageviews ?? 0)}
                    {perVisitor >= 1.5 && <span className="ml-1.5 text-xs text-stone-500">×{perVisitor.toFixed(1)} each</span>}
                  </td>
                  {paid && <td className="py-2.5 pl-3 pr-3 text-right max-sm:hidden">{money(g.revenue)}</td>}
                </tr>
                {expanded && (
                  <tr className="bg-stone-50/60">
                    <td />
                    <td colSpan={cols - 1} className="px-2 pb-3 pt-1">
                      <GoalSources goal={label} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      <p className="px-2 pt-3 text-xs text-stone-500">Conversion is the share of all visitors in this period; the change compares it with the previous period. Star a goal to keep it on top.</p>
    </div>
  );
}

/** Change in conversion vs the previous period, in percentage points. */
function RateChange({ cur, prevVisitors, prevTotal }: { cur: number; prevVisitors?: number; prevTotal: number }) {
  if (prevVisitors === undefined || !prevTotal) return null;
  if (!prevVisitors) return cur > 0 ? <span className="text-xs text-stone-500">new</span> : null;
  const pts = (cur - prevVisitors / prevTotal) * 100;
  if (Math.abs(pts) < 0.05) return <span className="text-xs text-stone-500">±0</span>;
  return (
    <span className={`text-xs ${pts > 0 ? 'text-emerald-800' : 'text-red-700'}`} title="Percentage points vs the previous period">
      {pts > 0 ? '▲' : '▼'} {Math.abs(pts).toFixed(1)}<span className="max-sm:hidden"> pts</span>
    </span>
  );
}

/** Top channels and referrers for one goal: which source drives it. */
function GoalSources({ goal }: { goal: string }) {
  const { site, q, reloadKey, addFilters } = useDash();
  const scoped = { ...q, filters: { ...q.filters, goal } };
  const channels = useApi<BreakdownRow[]>(`/api/sites/${site.id}/breakdown?${qs(scoped, { dim: 'channel', limit: 3 })}`, reloadKey).data;
  const sources = useApi<BreakdownRow[]>(`/api/sites/${site.id}/breakdown?${qs(scoped, { dim: 'source', limit: 3 })}`, reloadKey).data;
  const list = (title: string, rows: BreakdownRow[] | null, dim: 'channel' | 'source') => (
    <div className="min-w-[200px] flex-1">
      <div className="mb-1 text-xs font-medium text-stone-500">{title}</div>
      {!rows ? (
        <div className="h-12 animate-pulse rounded-lg bg-stone-100" />
      ) : !rows.length ? (
        <div className="text-stone-500">—</div>
      ) : (
        rows.map((r) => (
          <button
            key={r.label ?? ''}
            className="flex w-full items-center justify-between gap-3 rounded-md px-1.5 py-0.5 text-left hover:bg-stone-100"
            onClick={() => addFilters({ goal, [dim]: r.label ?? '' })}
          >
            <span className="flex min-w-0 items-center gap-1.5">{renderLabel(dim, r)}</span>
            <span className="font-medium">{fmtNumber(r.visitors)}</span>
          </button>
        ))
      )}
    </div>
  );
  return (
    <div className="flex flex-wrap gap-6">
      {list('Top channels', channels, 'channel')}
      {list('Top referrers', sources, 'source')}
    </div>
  );
}

interface FunnelDef {
  id: string;
  name: string;
  steps: { type: 'page' | 'goal'; value: string }[];
}

function Funnels() {
  const { site, q, reloadKey } = useDash();
  const [version, setVersion] = useState(0);
  const { data: funnels } = useApi<FunnelDef[]>(`/api/sites/${site.id}/funnels`, version);
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const current = funnels?.find((f) => f.id === selected) ?? funnels?.[0];
  const { data: stats } = useApi<(FunnelDef['steps'][0] & { visitors: number })[]>(
    current ? `/api/sites/${site.id}/funnels/${current.id}/stats?${qs(q)}` : null,
    reloadKey + version,
  );

  if (!funnels) return <div className="h-40 animate-pulse" />;
  if (creating || !funnels.length)
    return (
      <FunnelForm
        onDone={(id) => {
          setCreating(false);
          if (id) setSelected(id);
          setVersion((v) => v + 1);
        }}
        canCancel={funnels.length > 0}
      />
    );

  return (
    <div className="px-3 pb-3">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <select className="input w-auto max-w-full py-1.5 font-medium" value={current?.id} onChange={(e) => setSelected(e.target.value)} aria-label="Funnel">
          {funnels.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <button className="btn py-1.5" onClick={() => setCreating(true)}>
          + New funnel
        </button>
        {current && (
          <ConfirmButton
            className="ml-auto rounded-lg px-2 py-1.5 text-sm text-stone-500 hover:bg-red-50 hover:text-red-700"
            confirmLabel="Delete for good?"
            onConfirm={async () => {
              await api(`/api/sites/${site.id}/funnels/${current.id}`, { method: 'DELETE' });
              setSelected(null);
              setVersion((v) => v + 1);
            }}
          >
            Delete funnel
          </ConfirmButton>
        )}
      </div>
      {!stats ? <div className="h-48 animate-pulse rounded-xl bg-stone-50" /> : <FunnelChart steps={stats} />}
    </div>
  );
}

type FunnelStat = FunnelDef['steps'][0] & { visitors: number };

/** Steps as horizontal rows, all scaled to the first step, with the people lost between each pair. */
function FunnelChart({ steps }: { steps: FunnelStat[] }) {
  const { addFilter } = useDash();
  const top = steps[0]?.visitors ?? 0;
  const last = steps[steps.length - 1];
  if (!top) return <p className="rounded-xl bg-stone-50 px-4 py-6 text-center text-sm text-stone-600">Nobody reached the first step in this period.</p>;

  // The step pair that loses the most people: where to look first.
  const lost = steps.map((s, i) => (i ? steps[i - 1].visitors - s.visitors : 0));
  const worst = lost.reduce((w, n, i) => (n > lost[w] ? i : w), 1);
  const overall = last.visitors / top;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[28px] font-semibold leading-tight tracking-tight tabular-nums">{fmtPct(overall, overall > 0 && overall < 0.1 ? 1 : 0)}</span>
        <span className="text-sm text-stone-600">
          of {fmtNumber(top)} visitors who {stepVerb(steps[0])} went on to {stepVerb(last, true)} ({fmtNumber(last.visitors)})
        </span>
      </div>
      <ol className="space-y-1">
        {steps.map((s, i) => {
          const pct = s.visitors / top;
          // Only exact paths and goals can become a dashboard filter; wildcard paths can't.
          const filterable = s.type === 'goal' || !s.value.includes('*');
          return (
            <li key={i}>
              {i > 0 && (
                <div className={`ml-3 flex items-center gap-2 border-l-2 py-1.5 pl-5 text-xs tabular-nums ${i === worst && lost[i] > 0 ? 'border-amber-200 text-amber-800' : 'border-stone-100 text-stone-500'}`}>
                  {lost[i] > 0 ? (
                    <>
                      −{fmtNumber(lost[i])} dropped off ({fmtPct(steps[i - 1].visitors ? lost[i] / steps[i - 1].visitors : 0)})
                      {i === worst && steps.length > 2 && <span className="rounded-md bg-amber-50 px-1.5 py-0.5 font-medium">Biggest drop-off</span>}
                    </>
                  ) : (
                    'No drop-off'
                  )}
                </div>
              )}
              <button
                className={`group grid w-full grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 rounded-xl px-1 py-1.5 text-left sm:grid-cols-[1.75rem_minmax(0,14rem)_minmax(0,1fr)_auto] ${filterable ? 'hover:bg-stone-50' : 'cursor-default'}`}
                onClick={() => filterable && addFilter(s.type === 'goal' ? 'goal' : 'page', s.value)}
                title={filterable ? `Filter the dashboard to visitors who ${stepVerb(s)}` : undefined}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-100 text-xs font-semibold text-stone-600">{i + 1}</span>
                <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                  <StepIcon type={s.type} />
                  <span className="truncate" title={s.value}>
                    {s.value}
                  </span>
                </span>
                <span className="col-span-3 row-start-2 h-3 overflow-hidden rounded-full bg-stone-100 sm:col-span-1 sm:col-start-3 sm:row-start-1">
                  <span className="block h-full rounded-full bg-visitors" style={{ width: `${Math.max(pct * 100, s.visitors ? 1 : 0)}%` }} />
                </span>
                <span className="col-start-3 row-start-1 whitespace-nowrap text-right text-sm tabular-nums sm:col-start-4">
                  <span className="font-semibold">{fmtNumber(s.visitors)}</span> <span className="text-stone-500">· {fmtPct(pct)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-xs text-stone-500">Counted in order per visitor. Click a step to filter the dashboard to it.</p>
    </div>
  );
}

const stepVerb = (s: FunnelDef['steps'][0], base = false) =>
  s.type === 'goal' ? `${base ? 'complete' : 'completed'} ${s.value}` : `${base ? 'visit' : 'visited'} ${s.value}`;

function StepIcon({ type }: { type: 'page' | 'goal' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-stone-500" aria-label={type === 'goal' ? 'Goal' : 'Page'} role="img">
      {type === 'goal' ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="4" />
        </>
      ) : (
        <>
          <path d="M6 3h8l4 4v14H6z" />
          <path d="M14 3v4h4" />
        </>
      )}
    </svg>
  );
}

function FunnelForm({ onDone, canCancel }: { onDone: (id?: string) => void; canCancel: boolean }) {
  const { site } = useDash();
  const [name, setName] = useState('Signup funnel');
  const [steps, setSteps] = useState<FunnelDef['steps']>([
    { type: 'page', value: '/' },
    { type: 'page', value: '/pricing' },
    { type: 'goal', value: 'checkout' },
  ]);
  const [error, setError] = useState('');
  const set = (i: number, patch: Partial<FunnelDef['steps'][0]>) => setSteps((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <form
      className="max-w-xl space-y-3 px-3 pb-3"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          const f = await api<FunnelDef>(`/api/sites/${site.id}/funnels`, { method: 'POST', json: { name, steps } });
          onDone(f.id);
        } catch (err) {
          setError((err as Error).message);
        }
      }}
    >
      <p className="text-sm text-stone-500">Steps are counted in order per visitor. Page paths support wildcards like <code>/blog/*</code>.</p>
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Funnel name" />
      {steps.map((s, i) => (
        <div key={i} className="flex gap-2">
          <select className="input w-28" value={s.type} onChange={(e) => set(i, { type: e.target.value as 'page' | 'goal' })}>
            <option value="page">Page</option>
            <option value="goal">Goal</option>
          </select>
          <input className="input" value={s.value} onChange={(e) => set(i, { value: e.target.value })} placeholder={s.type === 'page' ? '/pricing' : 'signup'} />
          <button type="button" className="btn px-3" onClick={() => setSteps((x) => x.filter((_, j) => j !== i))} disabled={steps.length <= 2}>
            ✕
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <button type="button" className="btn" onClick={() => setSteps((s) => [...s, { type: 'page', value: '' }])} disabled={steps.length >= 10}>
          + Step
        </button>
        <button className="btn-dark">Save funnel</button>
        {canCancel && (
          <button type="button" className="btn" onClick={() => onDone()}>
            Cancel
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}

function VisitorCell({ id, name, email, country, city, device, os, browser, badge }: Record<string, any>) {
  return (
    <div className="flex items-center gap-3">
      <Avatar id={id} size={44} />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{displayName(id, name, email)}</span>
          {badge}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-stone-500">
          <span className="flex items-center gap-1">
            <Flag cc={country} size={15} /> {city ? `${city}, ` : ''}
            {countryName(country)}
          </span>
          <span className="flex items-center gap-1">
            <DeviceIcon name={device} size={15} /> {device}
          </span>
          <span className="flex items-center gap-1">
            <OSIcon name={os} size={15} /> {os}
          </span>
          <span className="flex items-center gap-1">
            <BrowserIcon name={browser} size={15} /> {browser}
          </span>
        </div>
      </div>
    </div>
  );
}

function matches(r: Record<string, any>, search: string) {
  if (!search) return true;
  const s = search.toLowerCase();
  return ['name', 'email', 'pay_email', 'pay_name', 'source', 'country', 'city', 'visitor_id', 'utm_campaign', 'ref'].some((k) =>
    String(r[k] ?? '').toLowerCase().includes(s),
  );
}

function ShowAll({ total, shown, onClick }: { total: number; shown: number; onClick: () => void }) {
  if (total <= shown) return null;
  return (
    <button className="mx-auto mt-3 block text-xs font-semibold uppercase tracking-wider text-stone-500 hover:text-ink" onClick={onClick}>
      Show all {total}
    </button>
  );
}

const MATCH_LABELS: Record<string, string> = {
  return_page: 'return page',
  customer: 'earlier payment',
  email: 'email',
  timing: 'checkout click timing',
};

function Journey({ search }: { search: string }) {
  const { site, q, reloadKey, money, openVisitor } = useDash();
  const [all, setAll] = useState(false);
  const [version, setVersion] = useState(0);
  const [rematch, setRematch] = useState<string | null>(null);
  const [reasons, setReasons] = useState<{ id: string; name: string | null; matched: boolean; reason: string | null }[]>([]);
  const { data } = useApi<any[]>(`/api/sites/${site.id}/customers?${qs(q)}`, reloadKey + version);
  if (!data) return <div className="h-40 animate-pulse" />;
  if (!data.length)
    return <div className="p-8 text-center text-sm text-stone-500">No payments in this period. Connect Dodo Payments or Stripe in site settings to see who paid and where they came from.</div>;
  const unmatched = data.filter((r) => !r.visitor_id).length;
  return (
    <div className="overflow-x-auto">
      {unmatched > 0 && (
        <div className="mx-3 mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>
            {unmatched} payment{unmatched > 1 ? 's' : ''} not linked to a visitor yet.{' '}
            <a className="underline" href={`/site/${site.id}/settings`}>
              Why?
            </a>
          </span>
          <button
            className="btn py-1.5"
            disabled={rematch === 'working'}
            onClick={async () => {
              setRematch('working');
              const r = await api<{ matched: number; checked: number; details: typeof reasons }>(`/api/sites/${site.id}/rematch`, {
                method: 'POST',
              });
              setRematch(`Matched ${r.matched} of ${r.checked}`);
              setReasons(r.details ?? []);
              setVersion((v) => v + 1);
            }}
          >
            {rematch === 'working' ? 'Matching…' : rematch ?? 'Try matching again'}
          </button>
          {reasons.length > 0 && (
            <ul className="w-full space-y-1 border-t border-amber-200 pt-2 text-xs">
              {reasons.map((r) => (
                <li key={r.id}>
                  <b>{r.name ?? r.id}</b>: {r.matched ? '✓ matched' : '✗ not matched'}
                  {r.reason ? ` · ${r.reason}` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <table className="w-full min-w-[760px] text-[15px]">
        <thead>
          <tr className="text-left text-sm text-stone-500">
            <th className="px-3 pb-3 font-medium">Visitor</th>
            <th className="pb-3 font-medium">Source</th>
            <th className="pb-3 font-medium">Spent</th>
            <th className="pb-3 font-medium">Time to complete</th>
            <th className="pb-3 font-medium">Completed at</th>
          </tr>
        </thead>
        <tbody>
          {data
            .filter((r) => matches(r, search))
            .slice(0, all || search ? undefined : 10)
            .map((r) => (
              <tr
                key={r.id}
                className={`border-t border-stone-100 ${r.visitor_id ? 'cursor-pointer hover:bg-stone-50' : ''}`}
                onClick={() => r.visitor_id && openVisitor(r.visitor_id)}
              >
                <td className="px-3 py-4">
                  <VisitorCell
                    id={r.visitor_id ?? r.id}
                    name={r.name ?? r.pay_name}
                    email={r.email ?? r.pay_email}
                    country={r.country}
                    city={null}
                    device={r.device}
                    os={r.os}
                    browser={r.browser}
                    badge={
                      <span className="rounded-md border border-revenue/30 bg-revenueSoft/50 px-1.5 py-0.5 text-xs text-revenue">
                        {r.renewal ? 'Returning' : 'Customer'}
                      </span>
                    }
                  />
                </td>
                <td className="py-4">
                  {r.session_id ? (
                    <div className="flex items-center gap-2">
                      <SourceIcon source={r.source} domain={r.referrer_domain} />
                      <div>
                        <div>{r.source}</div>
                        {(r.utm_campaign || r.ref) && <div className="text-xs text-stone-500">{r.utm_campaign || r.ref}</div>}
                        {r.matched_by && r.matched_by !== 'metadata' && (
                          <div className="text-xs text-stone-400" title="How this payment was linked to the visitor">
                            matched by {MATCH_LABELS[r.matched_by] ?? r.matched_by}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <span className="text-stone-400" title="No visitor id in the payment metadata, and no return-page, email or timing match">
                      Not attributed
                    </span>
                  )}
                </td>
                <td className="py-4 font-medium">{money(r.amount)}</td>
                <td className="py-4">
                  {r.first_seen ? fmtAgo(r.ts - r.first_seen) : '—'}
                  {r.visits > 0 && <div className="text-xs text-stone-500">{r.visits} visit{r.visits > 1 ? 's' : ''}</div>}
                </td>
                <td className="py-4">{fmtDateTime(r.ts, site.timezone)}</td>
              </tr>
            ))}
        </tbody>
      </table>
      {!search && <ShowAll total={data.length} shown={all ? data.length : 10} onClick={() => setAll(true)} />}
    </div>
  );
}

function Users({ search }: { search: string }) {
  const { site, q, reloadKey, money, openVisitor } = useDash();
  const [all, setAll] = useState(false);
  const { data } = useApi<any[]>(`/api/sites/${site.id}/visitors?${qs(q)}`, reloadKey);
  if (!data) return <div className="h-40 animate-pulse" />;
  if (!data.length) return <div className="p-8 text-center text-sm text-stone-500">No visitors in this period.</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-[15px]">
        <thead>
          <tr className="text-left text-sm text-stone-500">
            <th className="px-3 pb-3 font-medium">Visitor</th>
            <th className="pb-3 font-medium">Source</th>
            <th className="pb-3 text-right font-medium">Visits</th>
            <th className="pb-3 text-right font-medium">Pages</th>
            <th className="pb-3 text-right font-medium">Time</th>
            <th className="pb-3 text-right font-medium">Spent</th>
            <th className="px-3 pb-3 text-right font-medium">Last seen</th>
          </tr>
        </thead>
        <tbody>
          {data
            .filter((r) => matches(r, search))
            .slice(0, all || search ? undefined : 10)
            .map((r) => (
              <tr key={r.visitor_id} className="cursor-pointer border-t border-stone-100 hover:bg-stone-50" onClick={() => openVisitor(r.visitor_id)}>
                <td className="px-3 py-3">
                  <VisitorCell
                    id={r.visitor_id}
                    name={r.name}
                    email={r.email}
                    country={r.country}
                    city={r.city}
                    device={r.device}
                    os={r.os}
                    browser={r.browser}
                    badge={r.spent > 0 ? <span className="rounded-md border border-revenue/30 bg-revenueSoft/50 px-1.5 py-0.5 text-xs text-revenue">Customer</span> : null}
                  />
                </td>
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    <SourceIcon source={r.source} domain={r.referrer_domain} /> {r.source}
                  </div>
                </td>
                <td className="py-3 text-right">{r.sessions}</td>
                <td className="py-3 text-right">{r.pageviews}</td>
                <td className="py-3 text-right">{fmtDuration(r.duration)}</td>
                <td className="py-3 text-right">{r.spent ? money(r.spent) : '—'}</td>
                <td className="px-3 py-3 text-right text-stone-500">{fmtAgo(Date.now() - r.last_seen)} ago</td>
              </tr>
            ))}
        </tbody>
      </table>
      {!search && <ShowAll total={data.length} shown={all ? data.length : 10} onClick={() => setAll(true)} />}
    </div>
  );
}
