import { displayName } from '../../shared/names';
import { useDash } from '../lib/context';
import { countryName, fmtAgo, fmtDateTime, fmtDuration, fmtPaidIn } from '../lib/format';
import { useApi } from '../lib/useApi';
import { buildTimeline, fmtOffset } from '../lib/timeline';
import { Avatar, BrowserIcon, DeviceIcon, Flag, OSIcon, SourceIcon } from './Icons';
import { Modal } from './Modal';

interface Profile {
  visitor: { id: string; first_seen: number; name: string | null; email: string | null; user_id: string | null } | null;
  sessions: any[];
  events: { session_id: string; ts: number; type: string; name: string | null; path: string; props: string | null }[];
  payments: any[];
}

export function VisitorModal({ visitorId, onClose }: { visitorId: string | null; onClose: () => void }) {
  const { site, money } = useDash();
  // The parent remounts this per visitor (key), so `data` always belongs to `visitorId`.
  const { data: p } = useApi<Profile>(visitorId ? `/api/sites/${site.id}/visitors/${visitorId}` : null);
  const last = p?.sessions[0];
  const firstSession = p?.sessions[p.sessions.length - 1];
  const paid = p?.payments.reduce((a, x) => a + x.amount, 0) ?? 0;
  const firstPayment = p?.payments.filter((x) => x.kind === 'payment').at(-1);

  const timeline = p ? buildTimeline(p) : [];
  const clock = (ts: number) => new Intl.DateTimeFormat('en', { timeZone: site.timezone, hour: 'numeric', minute: '2-digit' }).format(ts);

  return (
    <Modal open={!!visitorId} onClose={onClose} width="max-w-3xl" title="Visitor profile">
      {!p && <div className="h-60 animate-pulse rounded-xl bg-stone-50" />}
      {p && (
        <div>
          <div className="flex items-center gap-4">
            <Avatar id={visitorId!} size={64} />
            <div className="min-w-0">
              <div className="truncate text-xl font-semibold">{displayName(visitorId!, p.visitor?.name, p.visitor?.email)}</div>
              {p.visitor?.email && p.visitor.name && <div className="text-sm text-stone-500">{p.visitor.email}</div>}
              {last && (
                <div className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-stone-500">
                  <span className="flex items-center gap-1">
                    <Flag cc={last.country} size={15} /> {last.city ? `${last.city}, ` : ''}
                    {countryName(last.country)}
                  </span>
                  <span className="flex items-center gap-1">
                    <DeviceIcon name={last.device} size={15} /> {last.device}
                  </span>
                  <span className="flex items-center gap-1">
                    <OSIcon name={last.os} size={15} /> {last.os}
                  </span>
                  <span className="flex items-center gap-1">
                    <BrowserIcon name={last.browser} size={15} /> {last.browser}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="First source" value={firstSession?.source ?? '—'} />
            <Stat label="Visits" value={String(p.sessions.length)} />
            <Stat label="Total spent" value={money(paid)} accent={paid > 0} />
            <Stat
              label="Time to first payment"
              value={firstPayment && p.visitor ? fmtAgo(firstPayment.ts - p.visitor.first_seen) : '—'}
            />
          </div>

          <div className="mt-8 flex items-baseline justify-between gap-3">
            <h3 className="font-semibold">Journey</h3>
            <span className="text-xs text-stone-500">Oldest first · times in {site.timezone}</span>
          </div>
          <ol className="mt-3">
            {timeline.map((item, idx) =>
              item.kind === 'gap' ? (
                <li key={`gap-${idx}`} className="flex items-center gap-3 py-2 pl-[5px] text-xs text-stone-500">
                  <span className="h-4 border-l-2 border-dashed border-stone-200" aria-hidden="true" />
                  {item.label}
                </li>
              ) : item.kind === 'payment' ? (
                <li key={`pay-${item.pay.id}`} className="relative border-l-2 border-stone-100 py-2 pl-5">
                  <span className="absolute -left-[7px] top-3 h-3 w-3 rounded-full bg-revenue ring-4 ring-surface" />
                  <PaymentLine pay={item.pay} when={fmtDateTime(item.pay.ts, site.timezone)} money={money} />
                </li>
              ) : (
                <li key={item.s.id} className="relative border-l-2 border-stone-100 pb-2 pl-5">
                  <span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full bg-visitors ring-4 ring-surface" />
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <span className="font-semibold">Visit {item.n}</span>
                    <span className="text-stone-500">· {fmtDateTime(item.s.started_at, site.timezone)}</span>
                    <span className="flex items-center gap-1.5 rounded-md bg-stone-100 px-2 py-0.5">
                      <SourceIcon source={item.s.source} domain={item.s.referrer_domain} size={14} /> {item.s.source ?? 'Direct'}
                    </span>
                    {item.s.utm_campaign && <span className="rounded-md bg-amber-50 px-2 py-0.5 text-amber-800">campaign: {item.s.utm_campaign}</span>}
                    {item.s.ref && <span className="rounded-md bg-amber-50 px-2 py-0.5 text-amber-800">ref: {item.s.ref}</span>}
                    {/* Length = first to last step on the clock; engaged = time the tab was actually in view. They often differ. */}
                    <span className="text-stone-500" title="From the first to the last step · time the page was in view">
                      · {fmtDuration(Math.max(0, item.s.last_seen_at - item.s.started_at))} long · {fmtDuration(item.s.duration)} engaged
                    </span>
                  </div>
                  {item.s.referrer && <div className="mt-0.5 max-w-full truncate text-xs text-stone-500">from {item.s.referrer}</div>}
                  <ol className="mt-2 space-y-0.5 text-sm">
                    {item.steps.map((st, i) => (
                      <li key={i} className="grid grid-cols-[4.5rem_3.25rem_1.25rem_minmax(0,1fr)] items-start gap-x-2 rounded-md py-0.5">
                        <span className="text-xs leading-5 text-stone-500 tabular-nums">{clock(st.ts)}</span>
                        <span className="text-xs leading-5 text-stone-400 tabular-nums" title="Time since the visit started">
                          {i === 0 ? 'start' : `+${fmtOffset(st.ts - item.s.started_at)}`}
                        </span>
                        <span className={`mt-0.5 ${st.type === 'payment' ? 'text-revenue' : st.type === 'goal' ? 'text-ink' : 'text-stone-400'}`} aria-hidden="true">
                          <StepIcon type={st.type} />
                        </span>
                        <span className="min-w-0">
                          {st.type === 'pageview' && (
                            <>
                              <span className="break-all text-stone-700">Viewed {st.path}</span>
                              {st.dwell !== null && <span className="ml-2 text-xs text-stone-500">{fmtDuration(st.dwell)} on page</span>}
                            </>
                          )}
                          {st.type === 'goal' && (
                            <span className="font-medium">
                              Completed {st.name} <span className="font-normal text-stone-500">on {st.path}</span>
                            </span>
                          )}
                          {st.type === 'outbound' && <span className="break-all text-stone-700">Left to {st.name?.replace(/^https?:\/\//, '')}</span>}
                          {st.type === 'payment' && st.pay && <PaymentLine pay={st.pay} money={money} />}
                        </span>
                      </li>
                    ))}
                  </ol>
                </li>
              ),
            )}
          </ol>
        </div>
      )}
    </Modal>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-stone-50 px-4 py-3">
      <div className="text-xs text-stone-500">{label}</div>
      <div className={`mt-0.5 truncate font-semibold ${accent ? 'text-revenue' : ''}`}>{value}</div>
    </div>
  );
}

function PaymentLine({ pay, when, money }: { pay: any; when?: string; money: (n: number) => string }) {
  const what = pay.kind === 'refund' ? 'Refunded' : pay.renewal ? 'Renewed' : 'Paid';
  return (
    <span className="font-semibold text-revenue">
      {what} {money(Math.abs(pay.amount))}
      {fmtPaidIn(pay) && <span className="font-normal text-stone-500"> (paid {fmtPaidIn(pay)})</span>}
      {when && <span className="ml-2 font-normal text-stone-500">{when}</span>}
    </span>
  );
}

function StepIcon({ type }: { type: string }) {
  const d =
    type === 'goal'
      ? 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z'
      : type === 'outbound'
        ? 'M7 17 17 7M8 7h9v9'
        : type === 'payment'
          ? 'M3 6h18v12H3zM3 10h18'
          : 'M6 3h8l4 4v14H6zM14 3v4h4';
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}
