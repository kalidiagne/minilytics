import { qs, type BreakdownRow, type Overview } from '../lib/api';
import { useDash } from '../lib/context';
import { bucketLabel, countryName, fmtNumber, goalName } from '../lib/format';
import { useApi } from '../lib/useApi';

/** One sentence above the KPIs: how many people, from where, the busiest bucket, and what's missing. */
export function Summary({ data, pins = [] }: { data: Overview | null; pins?: string[] }) {
  const { site, q, reloadKey, money } = useDash();
  const top = (dim: string) => useApi<BreakdownRow[]>(`/api/sites/${site.id}/breakdown?${qs(q, { dim, limit: 1 })}`, reloadKey).data?.[0]?.label;
  const channel = top('channel');
  const country = top('country');
  // Starred goals get named in the sentence, e.g. "3 completed Waitlist signup".
  const goals = useApi<BreakdownRow[]>(pins.length ? `/api/sites/${site.id}/breakdown?${qs(q, { dim: 'goal' })}` : null, reloadKey).data;
  const pinned = pins.map((p) => ({ name: p, n: goals?.find((g) => g.label === p)?.visitors ?? 0 }));
  if (!data) return <div className="h-7" />;

  const c = data.current;
  if (!c.visitors) return <p className="text-lg text-stone-600">No visitors in this period yet.</p>;
  const peak = data.series.reduce((a, b) => (b.visitors > a.visitors ? b : a), data.series[0]);
  const paid = !!(site.dodo_webhook_secret || site.stripe_webhook_secret || data.hasPayments || c.revenue || data.previous.revenue);
  const from = [channel, country && countryName(country)].filter(Boolean);
  const B = ({ children }: { children: React.ReactNode }) => <strong className="font-semibold text-ink">{children}</strong>;

  return (
    <p className="max-w-4xl text-lg leading-snug text-stone-600">
      <B>{fmtNumber(c.visitors)} {c.visitors === 1 ? 'person' : 'people'}</B> visited
      {from.length > 0 && (
        <>
          , mostly from <B>{from[0]}</B>
          {from[1] && (
            <>
              {' '}and <B>{from[1]}</B>
            </>
          )}
        </>
      )}
      .{' '}
      {goals &&
        pinned.map((g) => (
          <span key={g.name}>
            <B>{fmtNumber(g.n)}</B> completed {goalName(g.name)}.{' '}
          </span>
        ))}
      {data.series.length > 1 && peak.visitors > 0 && <>Busiest: {bucketLabel(peak.bucket, data.range.granularity, true)}. </>}
      {/* No payments yet: the KPI card already offers to connect them (and can be hidden). */}
      {paid && (
        <>
          <B>{money(c.revenue)}</B> in revenue.
        </>
      )}
    </p>
  );
}
