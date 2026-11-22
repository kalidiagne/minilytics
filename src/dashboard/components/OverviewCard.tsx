import { Fragment } from 'react';
import { usePref } from '../lib/prefs';
import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { navigate } from '../App';
import type { Kpis, Overview } from '../lib/api';
import { useDash } from '../lib/context';
import { bucketLabel, fmtDuration, fmtNumber, fmtPct } from '../lib/format';

type Metric = 'visitors' | 'revenue';

function Change({ cur, prev, invert = false }: { cur: number; prev: number; invert?: boolean }) {
  // Nothing to compare against: say nothing rather than a row of dashes.
  if (!prev) return null;
  const pct = (cur - prev) / prev;
  if (!Number.isFinite(pct)) return null;
  const up = pct >= 0;
  const good = invert ? !up : up;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs ${good ? 'text-emerald-600' : 'text-red-500'}`}>
      {Math.abs(Math.round(pct * 100))}% {up ? '↑' : '↓'}
    </span>
  );
}

export function OverviewCard({ data, onLive }: { data: Overview | null; onLive: () => void }) {
  const { money, site } = useDash();
  const [prefHidden, setHidden] = usePref<Record<Metric, boolean>>('ml_chart_hidden', { visitors: false, revenue: false });
  const [showBots, setShowBots] = usePref('ml_chart_bots', false);
  const c = data?.current;
  const p = data?.previous;
  // Revenue tiles only mean something once a payment source is connected (or payments arrived through the API).
  const paid = !!(site.dodo_webhook_secret || site.stripe_webhook_secret || c?.revenue || p?.revenue);
  const hidden = paid ? prefHidden : { ...prefHidden, revenue: true };
  const bots = data?.bots;

  const kpis: { key: keyof Kpis | 'online'; label: string; value: string; invert?: boolean; metric?: Metric; dot?: string }[] = c
    ? [
        { key: 'visitors', label: 'Visitors', value: fmtNumber(c.visitors), metric: 'visitors', dot: 'bg-visitors' },
        ...(paid
          ? ([
              { key: 'revenue', label: 'Revenue', value: money(c.revenue, true), metric: 'revenue', dot: 'bg-revenue' },
              { key: 'conversionRate', label: 'Conversion', value: fmtPct(c.conversionRate, c.conversionRate >= 0.1 ? 0 : 2) },
              { key: 'revenuePerVisitor', label: 'Rev/visitor', value: money(c.revenuePerVisitor) },
            ] as const)
          : []),
        { key: 'bounceRate', label: 'Bounce rate', value: fmtPct(c.bounceRate), invert: true },
        { key: 'avgDuration', label: 'Session time', value: fmtDuration(c.avgDuration) },
      ]
    : [];

  const g = data?.range.granularity ?? 'day';

  return (
    <div className="card overflow-hidden">
      <div className={`grid grid-cols-2 border-b border-stone-100 sm:grid-cols-4 ${paid ? 'lg:grid-cols-7' : 'lg:grid-cols-6'}`}>
        {kpis.map((k, i) => (
          <Fragment key={k.key}>
            <div className={`border-stone-100 px-5 py-4 lg:border-r ${i === 0 && !paid ? 'max-sm:col-span-2' : ''}`}>
              <button
                className={`block w-full text-left ${k.metric ? '' : 'cursor-default'}`}
                onClick={() => k.metric && setHidden((h) => ({ ...h, [k.metric!]: !h[k.metric!] }))}
                title={k.metric ? 'Show/hide on chart' : undefined}
              >
                <div className="flex items-center gap-1.5 text-sm text-stone-500">
                  {k.dot && <span className={`h-2.5 w-2.5 rounded-sm ${k.dot} ${hidden[k.metric!] ? 'opacity-25' : ''}`} />}
                  {k.label}
                </div>
                <div className="mt-1 text-[28px] font-semibold leading-tight tracking-tight">{k.value}</div>
                <Change cur={c![k.key as keyof Kpis]} prev={p![k.key as keyof Kpis]} invert={k.invert} />
              </button>
              {k.key === 'visitors' && !!bots?.visitors && (
                <button
                  className={`-ml-1.5 mt-1.5 flex items-center gap-1.5 whitespace-nowrap rounded-lg px-1.5 py-0.5 text-xs text-stone-500 hover:bg-stone-100 ${showBots ? 'bg-stone-100' : ''}`}
                  onClick={() => setShowBots(!showBots)}
                  title={`${bots.burst} burst · ${bots.datacenter} datacenter. Never counted in visitors, goals or revenue.`}
                >
                  <BotIcon />+{fmtNumber(bots.visitors)} bots filtered
                  <span className="text-stone-400">{showBots ? 'Hide' : 'Show'}</span>
                </button>
              )}
            </div>
            {i === 0 && data && !paid && (
              <button
                className="col-span-2 flex flex-col justify-center gap-1 border-stone-100 bg-revenueSoft/30 px-5 py-4 text-left hover:bg-revenueSoft/50 lg:border-r"
                onClick={() => navigate(`/site/${site.id}/settings?tab=setup&step=payments`)}
              >
                <span className="flex items-center gap-1.5 text-sm text-stone-500">
                  <span className="h-2.5 w-2.5 rounded-sm bg-revenue" /> Revenue · Conversion · Rev/visitor
                </span>
                <span className="font-semibold">Connect Stripe or Dodo to see which source pays</span>
                <span className="text-sm font-medium text-amber-800">Set up payments →</span>
              </button>
            )}
          </Fragment>
        ))}
        {data && (
          <button className="px-5 py-4 text-left hover:bg-stone-50" onClick={onLive} title="Open the live map (M)">
            <div className="flex items-center gap-1.5 text-sm text-stone-500">
              Online <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            </div>
            <div className="mt-1 text-[28px] font-semibold leading-tight">{data.online}</div>
            <div className="text-xs text-stone-500">View on map →</div>
          </button>
        )}
        {!data && <div className="col-span-full h-[98px] animate-pulse bg-stone-50" />}
      </div>

      <div className="h-[340px] px-2 pb-3 pt-6 sm:px-4">
        {data && hidden.visitors && hidden.revenue && (
          <button
            className="flex h-full w-full items-center justify-center text-sm text-stone-500 hover:text-ink"
            onClick={() => setHidden({ visitors: false, revenue: false })}
          >
            {paid ? 'Visitors and revenue are hidden. Click to show them.' : 'Visitors are hidden. Click to show them.'}
          </button>
        )}
        {data && !(hidden.visitors && hidden.revenue) && (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.series} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="vis" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8dbdf0" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#8dbdf0" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="rgb(var(--stone-100))" strokeDasharray="4 4" />
              <XAxis
                dataKey="bucket"
                tickFormatter={(b) => bucketLabel(b, g)}
                tick={{ fill: 'rgb(var(--stone-400))', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis
                yAxisId="v"
                tick={{ fill: 'rgb(var(--stone-400))', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={44}
                allowDecimals={false}
                tickFormatter={(v) => fmtNumber(v)}
              />
              <YAxis
                yAxisId="r"
                orientation="right"
                tick={{ fill: 'rgb(var(--stone-400))', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={56}
                tickFormatter={(v) => money(v, true)}
                hide={hidden.revenue}
                // Headroom keeps revenue bars in the lower part of the chart, under the visitors line.
                domain={[0, (max: number) => Math.max(1, Math.ceil(max * 1.6))]}
              />
              <Tooltip
                cursor={{ fill: 'rgb(var(--ink) / 0.04)' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as Overview['series'][0];
                  return (
                    <div className="card min-w-[180px] px-4 py-3 text-sm">
                      <div className="mb-2 font-medium">{bucketLabel(d.bucket, g, true)}</div>
                      <Row color="bg-visitors" label="Visitors" value={fmtNumber(d.visitors)} />
                      <Row color="bg-stone-300" label="Pageviews" value={fmtNumber(d.pageviews)} />
                      {paid && <Row color="bg-revenue" label="Revenue" value={money(d.revenue)} />}
                      {showBots && <Row color="bg-stone-400" label="Bots, not counted" value={fmtNumber(d.bots)} />}
                      {d.payments > 0 && <Row color="bg-revenueSoft" label="Payments" value={String(d.payments)} />}
                    </div>
                  );
                }}
              />
              {!hidden.revenue && (
                <Bar yAxisId="r" dataKey="revenue" fill="#e07b5f" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
              )}
              {!hidden.visitors && (
                <Area
                  yAxisId="v"
                  type="monotone"
                  dataKey="visitors"
                  stroke="#7cb1ea"
                  strokeWidth={2.5}
                  fill="url(#vis)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#7cb1ea', stroke: 'rgb(var(--surface))', strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              )}
              {showBots && (
                <Line yAxisId="v" type="monotone" dataKey="bots" stroke="rgb(var(--stone-400))" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={false} isAnimationActive={false} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function Row({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-6 py-0.5">
      <span className="flex items-center gap-2 text-stone-500">
        <span className={`h-2.5 w-2.5 rounded-sm ${color}`} />
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function BotIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="4" y="8" width="16" height="12" rx="3" />
      <path d="M12 4v4M9 13h.01M15 13h.01" />
    </svg>
  );
}
