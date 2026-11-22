import { AppHeader } from '../components/AppHeader';
import { BotsSection } from '../components/BotsSection';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { navigate } from '../App';
import { GoalsPanel } from '../components/GoalsPanel';
import { OverviewCard } from '../components/OverviewCard';
import { Summary } from '../components/Summary';
import { Panel, renderLabel } from '../components/Panel';
import { Toolbar } from '../components/Toolbar';
import { VisitorModal } from '../components/VisitorModal';
import { qs, type Overview, type Site } from '../lib/api';
import { DashContext, type Dash } from '../lib/context';
import { fmtMoney } from '../lib/format';
import { useApi } from '../lib/useApi';
import { useQueryState } from '../lib/useQueryState';
import { usePref } from '../lib/prefs';

// The globe pulls in a map library, so it's only downloaded when opened.
const LiveView = lazy(() => import('../components/LiveView'));

const FILTER_LABELS: Record<string, { label: string; dim: string }> = {
  channel: { label: 'Channel', dim: 'channel' },
  source: { label: 'Referrer', dim: 'source' },
  utm_campaign: { label: 'Campaign', dim: 'campaign' },
  utm_term: { label: 'Keyword', dim: 'keyword' },
  utm_source: { label: 'UTM source', dim: 'utm_source' },
  utm_medium: { label: 'UTM medium', dim: 'utm_medium' },
  ref: { label: 'Ref', dim: 'ref' },
  country: { label: 'Country', dim: 'country' },
  region: { label: 'Region', dim: 'region' },
  city: { label: 'City', dim: 'city' },
  browser: { label: 'Browser', dim: 'browser' },
  os: { label: 'OS', dim: 'os' },
  device: { label: 'Device', dim: 'device' },
  page: { label: 'Visited page', dim: 'page' },
  entry_page: { label: 'Entry page', dim: 'entry_page' },
  hostname: { label: 'Hostname', dim: 'hostname' },
  goal: { label: 'Completed goal', dim: 'goal' },
};

export function Dashboard({ siteId }: { siteId: string }) {
  const [q, update] = useQueryState(siteId);
  const [reloadKey, setReloadKey] = useState(0);
  const [visitor, setVisitor] = useState<string | null>(null);
  const [live, setLive] = useState(() => new URLSearchParams(window.location.search).get('live') === '1');
  // The toolbar sticks to the top; a 1px sentinel above it tells us when the page has scrolled under it.
  const sentinel = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  // "M" opens the live map, like DataFast.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key.toLowerCase() === 'm' && !e.metaKey && !e.ctrlKey && !/INPUT|TEXTAREA|SELECT/.test(t.tagName)) setLive(true);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);
  const { data: sites } = useApi<Site[]>('/api/sites');
  const site = sites?.find((s) => s.id === siteId);
  const hasSite = !!site;
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting));
    io.observe(el);
    // The bar shrinks once stuck. Scroll anchoring would compensate for that by scrolling back up,
    // un-sticking the bar and snapping short scrolls back to the top, so it's off on this page.
    const root = document.documentElement;
    root.style.overflowAnchor = 'none';
    return () => {
      io.disconnect();
      root.style.overflowAnchor = '';
    };
  }, [hasSite]);
  const { data: overview, loading } = useApi<Overview>(site ? `/api/sites/${siteId}/overview?${qs(q)}` : null, reloadKey);

  const addFilter = useCallback((key: string, value: string) => update({ filters: { ...q.filters, [key]: value } }), [q.filters, update]);
  const addFilters = useCallback((more: Record<string, string>) => update({ filters: { ...q.filters, ...more } }), [q.filters, update]);
  // Starred goals, per site: shown first in Goals and named in the summary.
  const [pins, setPins] = usePref<string[]>(`ml_goal_pins_${siteId}`, []);
  const removeFilter = (key: string) => {
    const { [key]: _, ...rest } = q.filters;
    update({ filters: rest });
  };

  const dash: Dash | null = useMemo(() => {
    if (!site) return null;
    const decimals = overview?.decimals ?? 2;
    return {
      site,
      q,
      reloadKey,
      decimals,
      money: (minor, compact) => fmtMoney(minor, site.currency, decimals, compact),
      addFilter,
      addFilters,
      openVisitor: setVisitor,
    };
  }, [site, q, reloadKey, overview?.decimals, addFilter, addFilters]);

  if (sites && !site) {
    return (
      <div className="p-10 text-center">
        Site not found.{' '}
        <button className="underline" onClick={() => navigate('/')}>
          Back to websites
        </button>
      </div>
    );
  }
  if (!dash || !site) return null;

  return (
    <DashContext.Provider value={dash}>
      <div className="mx-auto max-w-6xl px-4 pb-6 lg:pb-10">
        <h1 className="sr-only">{site.name}</h1>
        <div className="pt-8 sm:pt-12">
          <AppHeader>
            <button className="btn" onClick={() => navigate(`/site/${site.id}/settings`)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
              </svg>
              <span className="max-sm:sr-only">Settings</span>
            </button>
          </AppHeader>
        </div>
        <div ref={sentinel} className="h-px" aria-hidden />
        <div
          className={`sticky top-0 z-30 -mx-4 border-b bg-paper/90 px-4 backdrop-blur transition-[padding,border-color] duration-200 motion-reduce:transition-none ${
            stuck ? 'border-stone-200 py-2' : 'border-transparent pb-0 pt-8'
          }`}
        >
          <Toolbar
            compact={stuck}
            site={site}
            sites={sites!}
            q={q}
            update={update}
            overview={overview}
            onRefresh={() => setReloadKey((k) => k + 1)}
            onLive={() => setLive(true)}
            loading={loading}
          />

          {Object.keys(q.filters).length > 0 && (
            <div className={`${stuck ? 'mt-2' : 'mt-4'} flex flex-wrap items-center gap-2`}>
              {Object.entries(q.filters).map(([k, v]) => (
                <span key={k} className="flex items-center gap-2 rounded-xl border border-stone-200 bg-surface py-1 pl-3 pr-1 text-sm shadow-card">
                  <span className="text-stone-500">{FILTER_LABELS[k]?.label ?? k} is</span>
                  <span className="flex items-center gap-1.5 font-medium">{renderLabel(FILTER_LABELS[k]?.dim ?? k, { label: v || null })}</span>
                  <button className="rounded-lg px-1.5 text-stone-400 hover:bg-stone-100 hover:text-ink" onClick={() => removeFilter(k)} aria-label="Remove filter">
                    ✕
                  </button>
                </span>
              ))}
              <button className="text-sm text-stone-500 underline-offset-2 hover:underline" onClick={() => update({ filters: {} })}>
                Clear all
              </button>
            </div>
          )}
        </div>

        <div className="mt-5">
          <Summary data={overview} pins={pins} />
        </div>

        <div className="mt-4">
          <OverviewCard data={overview} onLive={() => setLive(true)} />
        </div>

        <Group title="Where they come from">
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel
              tabs={[
                { label: 'Channel', dim: 'channel', filter: 'channel' },
                { label: 'Referrer', dim: 'source', filter: 'source' },
                { label: 'Campaign', dim: 'campaign', filter: 'utm_campaign' },
                { label: 'Keyword', dim: 'keyword', filter: 'utm_term' },
              ]}
            />
            <Panel
              tabs={[
                { label: 'Country', dim: 'country', filter: 'country' },
                { label: 'Region', dim: 'region', filter: 'region' },
                { label: 'City', dim: 'city', filter: 'city' },
              ]}
            />
          </div>
        </Group>

        <Group title="What they do">
          <Panel
            tabs={[
              { label: 'Page', dim: 'page', filter: 'page' },
              { label: 'Entry page', dim: 'entry_page', filter: 'entry_page' },
              { label: 'Exit link', dim: 'exit_link' },
              { label: 'Hostname', dim: 'hostname', filter: 'hostname' },
            ]}
          />
          <div className="mt-5">
            <GoalsPanel
              totalVisitors={overview?.current.visitors ?? 0}
              prevVisitors={overview?.previous.visitors ?? 0}
              pins={pins}
              setPins={setPins}
              paid={!!(site.dodo_webhook_secret || site.stripe_webhook_secret || overview?.current.revenue || overview?.previous.revenue)}
            />
          </div>
        </Group>

        <Group title="What they use">
          <Panel
            tabs={[
              { label: 'Browser', dim: 'browser', filter: 'browser' },
              { label: 'OS', dim: 'os', filter: 'os' },
              { label: 'Device', dim: 'device', filter: 'device' },
            ]}
          />
        </Group>

        <Group title="Not people">
          <BotsSection key={site.id} bots={overview?.bots} />
        </Group>

        <p className="mt-8 text-center text-xs text-stone-500">
          Times in {site.timezone} · Revenue in {site.currency} ·{' '}
          <button className="underline-offset-2 hover:underline" onClick={() => navigate(`/site/${site.id}/settings`)}>
            Settings & install
          </button>
        </p>
      </div>
      {live && (
        <Suspense fallback={<div className="fixed inset-0 z-50 bg-[#070b1a]" />}>
          <LiveView onClose={() => setLive(false)} />
        </Suspense>
      )}
      <VisitorModal key={visitor ?? 'none'} visitorId={visitor} onClose={() => setVisitor(null)} />
    </DashContext.Provider>
  );
}

/** A labeled band of the dashboard, so related panels read as one group. */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10" aria-label={title}>
      <h2 className="mb-3 text-sm font-semibold text-stone-500">{title}</h2>
      {children}
    </section>
  );
}
