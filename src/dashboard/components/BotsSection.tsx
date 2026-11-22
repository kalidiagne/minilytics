import { useState } from 'react';
import type { Overview } from '../lib/api';
import { fmtNumber } from '../lib/format';
import { BotAnalytics } from './BotAnalytics';

/** Everything that isn't a person, in one place: sessions left out of the visitor numbers, and crawler requests. */
export function BotsSection({ bots }: { bots: Overview['bots'] | undefined }) {
  const [tab, setTab] = useState<'filtered' | 'crawlers' | null>(null);
  const filtered = bots?.visitors ?? 0;
  const active = tab ?? (filtered ? 'filtered' : 'crawlers');

  return (
    <section className="card mt-5 p-4 sm:px-5" aria-label="Bots">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-semibold">Bots</h2>
          <div className="tabs">
            <button className={`tab ${active === 'filtered' ? 'tab-active' : ''}`} onClick={() => setTab('filtered')}>
              Filtered from visitors <span className="tabular-nums text-stone-500">{fmtNumber(filtered)}</span>
            </button>
            <button className={`tab ${active === 'crawlers' ? 'tab-active' : ''}`} onClick={() => setTab('crawlers')}>
              Crawlers
            </button>
          </div>
        </div>
        <span className="text-sm text-stone-500">Never counted in visitors, goals or revenue</span>
      </div>

      {active === 'crawlers' && <BotAnalytics embedded />}
      {active === 'filtered' &&
        (!filtered ? (
          <p className="rounded-xl bg-stone-50 px-4 py-3 text-sm text-stone-600">No bot visits filtered in this period.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Burst" value={bots!.burst} note="Blank one-page visits arriving 3+ a minute" />
            <Stat label="Datacenter" value={bots!.datacenter} note="Cloud networks, under 10s and no goal" />
            <div className="rounded-xl border border-stone-100 p-4">
              <div className="text-sm text-stone-500">Pages they landed on</div>
              <ul className="mt-1 space-y-0.5 text-sm">
                {bots!.pages.map((p) => (
                  <li key={p.label ?? ''} className="flex justify-between gap-3">
                    <span className="truncate">{p.label ?? '(unknown)'}</span>
                    <span className="font-medium tabular-nums">{fmtNumber(p.n)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
    </section>
  );
}

function Stat({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="rounded-xl border border-stone-100 p-4">
      <div className="text-sm text-stone-500">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{fmtNumber(value)}</div>
      <div className="mt-1 text-sm text-stone-600">{note}</div>
    </div>
  );
}
