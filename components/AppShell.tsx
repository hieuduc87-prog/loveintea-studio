'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { KanbanSquare } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import { BrandDnaView }       from './BrandDnaView';
import { ProductsView }       from './ProductsView';
import { CreateStudioView }   from './CreateStudioView';
import { TextOverlayView }    from './TextOverlayView';
import { JobQueueView }       from './JobQueueView';
import { ContentQueueView }   from './ContentQueueView';
import { PublisherView }      from './PublisherView';
import { BlogFactoryView }    from './BlogFactoryView';
import { InboxView }          from './InboxView';
import { AnalyticsView }      from './AnalyticsView';
import { PlanCalendarView }   from './PlanCalendarView';
import { UserGuideView }      from './UserGuideView';
import { HelpDrawer }         from './HelpDrawer';
import { BrandMembersView } from './BrandMembersView';
import { AssetDamView }       from './AssetDamView';
import { ContentLogView }     from './ContentLogView';
import { PaymentView }        from './PaymentView';
import { BrandsView }         from './BrandsView';
import { ScoreboardView }   from './ScoreboardView';
import { ContentTemplatesView } from './ContentTemplatesView';
import { DashboardView }      from './DashboardView';
import { VideoStudioView }    from './VideoStudioView';
import { InspirationView }    from './InspirationView';
import { CostView }           from './CostView';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BrandSummary {
  id: string; name: string; slug: string;
  logo_url: string | null; domain: string | null; product_count: number;
}

type TabId =
  | 'dashboard'
  | 'brands' | 'brand_dna' | 'products' | 'scoreboard'
  | 'plan_calendar'
  | 'create_studio' | 'text_overlay' | 'video_studio' | 'inspiration' | 'blog_factory' | 'cost'
  | 'content_queue' | 'publisher' | 'job_queue'
  | 'analytics'
  | 'inbox'
  | 'content_templates'
  | 'asset_dam' | 'content_log'
  | 'payment'
  | 'guide' | 'team';

// Navigation restructured to match Closed-Loop Content Engine:
// Brain → Plan → Create → Review → Publish → Engage → Learn → (loop)
const TABS: { id: TabId; label: string; icon: string; group: string }[] = [
  // BẮT ĐẦU — hướng dẫn nổi bật ngay đầu sidebar, thấy ngay sau khi đăng nhập
  { id: 'guide',            label: 'Hướng dẫn sử dụng', icon: '📖', group: 'Bắt đầu' },
  // HOME — Dashboard tổng quan + system health
  { id: 'dashboard',        label: 'Dashboard',        icon: '🏠', group: 'Home' },
  // BRAIN — Brand identity + knowledge + rules (Fixed Core)
  { id: 'brand_dna',        label: 'Brand DNA',        icon: '🌿', group: 'Brain' },
  { id: 'products',         label: 'Products',         icon: '📦', group: 'Brain' },
  { id: 'content_templates', label: 'Content Templates', icon: '🎨', group: 'Brain' },
  // PLAN — Calendar, content plans, slot allocation
  { id: 'plan_calendar',    label: 'Plan & Lịch',      icon: '🗓️', group: 'Plan' },
  // CREATE — Copy track + Visual track + Blog
  { id: 'create_studio',    label: 'Tạo Content',      icon: '✨', group: 'Create' },
  { id: 'text_overlay',     label: 'Chữ lên ảnh',      icon: '🔤', group: 'Create' },
  { id: 'video_studio',     label: 'Video Studio',     icon: '🎬', group: 'Create' },
  { id: 'inspiration',      label: 'Nguồn học',        icon: '🕵️', group: 'Create' },
  { id: 'blog_factory',     label: 'Blog Factory',     icon: '📝', group: 'Create' },
  // REVIEW & PUBLISH — Queue (review desk), Schedule, Channels
  { id: 'content_queue',    label: 'Review & Queue',   icon: '✅', group: 'Publish' },
  { id: 'publisher',        label: 'Channels',         icon: '📡', group: 'Publish' },
  // ENGAGE — Community, inbox
  { id: 'inbox',            label: 'Inbox & Comments',  icon: '💬', group: 'Engage' },
  // LEARN — Analytics, feedback loop
  { id: 'analytics',        label: 'Analytics',        icon: '📊', group: 'Learn' },
  { id: 'scoreboard',       label: 'Scoreboard',       icon: '🏆', group: 'Learn' },
  { id: 'cost',             label: 'Cost & P&L',       icon: '💰', group: 'Learn' },
  // LIBRARY — Assets, images, logs
  { id: 'asset_dam',        label: 'Library',          icon: '🗃️', group: 'Library' },
  { id: 'content_log',      label: 'Content Log',      icon: '📜', group: 'Library' },
  { id: 'job_queue',        label: 'Job Queue',        icon: '⏳', group: 'Library' },
  // SYSTEM — Billing, guide, team
  { id: 'payment',          label: 'Billing',          icon: '💳', group: 'System' },
  { id: 'team',             label: 'Team & Access',    icon: '👥', group: 'System' },
  // Hidden
  { id: 'brands',           label: 'Manage Brands',    icon: '🏷️', group: '_hidden' },
];

// Closed-loop pipeline order
const NAV_GROUPS = ['Bắt đầu', 'Home', 'Brain', 'Plan', 'Create', 'Publish', 'Engage', 'Learn', 'Library', 'System'];
const PIPELINE_GROUPS = ['Brain', 'Plan', 'Create', 'Publish', 'Engage', 'Learn'];

const TAB_LABELS: Record<TabId, string> = Object.fromEntries(TABS.map(t => [t.id, t.label])) as Record<TabId, string>;

// ─── Brand Dropdown ────────────────────────────────────────────────────────────

function BrandDropdown({
  brands, activeBrand, onSwitch, onManage,
}: {
  brands: BrandSummary[];
  activeBrand: BrandSummary;
  onSwitch: (b: BrandSummary) => void;
  onManage: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative px-3 pb-3">
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl bg-gray-800 hover:bg-gray-750 border border-gray-700/50 transition-colors text-left"
      >
        {/* Brand logo / initials */}
        <div className="w-7 h-7 rounded-lg flex-shrink-0 bg-brand-600/30 flex items-center justify-center overflow-hidden">
          {activeBrand.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={activeBrand.logo_url} alt="" className="w-full h-full object-contain" />
          ) : (
            <span className="text-white text-xs font-bold">{activeBrand.name[0]}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white truncate leading-tight">{activeBrand.name}</p>
          <p className="text-[9px] text-gray-500 leading-tight">{activeBrand.product_count} products</p>
        </div>
        <span className={`text-gray-500 text-[10px] transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-3 right-3 mt-1 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          {brands.map(b => (
            <button
              key={b.id}
              onClick={() => { onSwitch(b); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-800 transition-colors text-left ${
                b.id === activeBrand.id ? 'bg-brand-600/15' : ''
              }`}
            >
              <div className="w-6 h-6 rounded-md flex-shrink-0 bg-gray-700 flex items-center justify-center overflow-hidden">
                {b.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.logo_url} alt="" className="w-full h-full object-contain" />
                ) : (
                  <span className="text-white text-[10px] font-bold">{b.name[0]}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">{b.name}</p>
                <p className="text-[9px] text-gray-500">{b.product_count} products</p>
              </div>
              {b.id === activeBrand.id && <span className="text-brand-400 text-[10px]">✓</span>}
            </button>
          ))}

          <div className="border-t border-gray-800 p-2">
            <button
              onClick={() => { onManage(); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-800 text-left transition-colors"
            >
              <span className="text-gray-400 text-sm">+</span>
              <span className="text-xs text-gray-400">Manage Brands…</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sidebar Content ───────────────────────────────────────────────────────────

function SidebarContent({
  tab, changeTab, onClose, userRole, pendingCount,
  brands, activeBrand, onBrandSwitch,
}: {
  tab: TabId;
  changeTab: (t: TabId) => void;
  onClose?: () => void;
  userRole?: string;
  pendingCount?: number;
  brands: BrandSummary[];
  activeBrand: BrandSummary;
  onBrandSwitch: (b: BrandSummary) => void;
}) {
  return (
    <>
      {/* Header */}
      <div className="px-3 pt-3 pb-1 flex-shrink-0">
        <div className="flex items-center gap-2 px-1 mb-2">
          <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg,#8b5cf6,#22d3ee)' }}>
            <span className="text-white text-[10px] font-bold">⚡</span>
          </div>
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Easy Creative Hub</span>
        </div>
        <BrandDropdown
          brands={brands}
          activeBrand={activeBrand}
          onSwitch={b => { onBrandSwitch(b); onClose?.(); }}
          onManage={() => { changeTab('brands'); onClose?.(); }}
        />
      </div>

      <nav className="flex-1 px-2 py-2 space-y-1 overflow-y-auto">
        {/* Pipeline flow indicator */}
        <div className="px-2 py-2 mb-1">
          <div className="flex items-center gap-0.5 text-[8px] font-mono text-gray-600">
            {['Brain','Plan','Create','Publish','Engage','Learn'].map((s, i) => {
              const isActive = TABS.find(t => t.id === tab)?.group === s;
              return (
                <span key={s} className="flex items-center gap-0.5">
                  <span className={`px-1 py-0.5 rounded ${isActive ? 'bg-brand-600/30 text-brand-400 font-bold' : ''}`}>{s}</span>
                  {i < 5 && <span className="text-gray-700">&rarr;</span>}
                </span>
              );
            })}
            <span className="text-gray-700 ml-0.5">&circlearrowleft;</span>
          </div>
        </div>

        {/* External links */}
        <div className="mb-2">
          <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-600">Tools</p>
          <Link href="/kanban" onClick={() => onClose?.()}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
            <KanbanSquare size={14} className="flex-shrink-0" />
            <span>Kanban</span>
          </Link>
        </div>

        {NAV_GROUPS.map((group) => {
          const items = TABS.filter(t => t.group === group);
          if (!items.length) return null;
          // Pipeline groups (Brain → Learn) get step numbers by NAME (không lệch khi thêm group đầu)
          const pipeIdx = PIPELINE_GROUPS.indexOf(group);
          const isPipeline = pipeIdx >= 0;
          const stepNum = pipeIdx + 1;
          const groupHasActive = items.some(t => t.id === tab);
          return (
            <div key={group} className={isPipeline ? 'relative' : ''}>
              <div className="flex items-center gap-1.5 px-2 mb-1">
                {isPipeline && (
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${
                    groupHasActive
                      ? 'bg-brand-600 text-white'
                      : 'bg-gray-800 text-gray-500 border border-gray-700'
                  }`}>{stepNum}</span>
                )}
                <p className={`text-[10px] font-semibold uppercase tracking-widest ${
                  groupHasActive && isPipeline ? 'text-brand-400' : 'text-gray-600'
                }`}>{group}</p>
              </div>
              {items.filter(t => {
                if (t.id === 'team') return userRole === 'root_admin' || userRole === 'admin';
                return true;
              }).map(t => (
                <button key={t.id}
                  onClick={() => { changeTab(t.id); onClose?.(); }}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors text-left ${
                    isPipeline ? 'ml-1' : ''
                  } ${
                    tab === t.id
                      ? 'bg-brand-600/20 text-white font-semibold'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}>
                  <span className="text-sm leading-none w-4 text-center flex-shrink-0">{t.icon}</span>
                  <span className="truncate flex-1">{t.label}</span>
                  {t.id === 'team' && pendingCount && pendingCount > 0 ? (
                    <span className="bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0">
                      {pendingCount > 9 ? '9+' : pendingCount}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          );
        })}
      </nav>

      <div className="px-4 py-2.5 border-t border-gray-800 flex-shrink-0">
        <p className="text-[10px] text-gray-600">Closed-Loop Content Engine v1.0</p>
      </div>
    </>
  );
}

// ─── AppShell ─────────────────────────────────────────────────────────────────

export function AppShell({ initialTab, fbSuccess, fbError }: {
  initialTab?: string; fbSuccess?: boolean; fbError?: string;
}) {
  const validInitialTab = TABS.find(t => t.id === initialTab) ? (initialTab as TabId) : null;
  const [tab, setTab]           = useState<TabId>(validInitialTab || 'dashboard');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  // Keep-alive: track which tabs have been visited so they stay mounted
  const [visitedTabs, setVisitedTabs] = useState<Set<TabId>>(() => new Set([validInitialTab || 'dashboard']));

  // Brand state
  const [brands, setBrands]           = useState<BrandSummary[]>([]);
  const [activeBrand, setActiveBrand] = useState<BrandSummary>({
    // Neutral placeholder — replaced by the user's own brand once /api/brands loads
    // (a customer must never see another tenant's name flash).
    id: 'loveintea', name: '…', slug: 'loveintea',
    logo_url: null, domain: null, product_count: 0,
  });

  const { data: session } = useSession();

  // Load brands list
  const loadBrands = useCallback(async () => {
    try {
      const r = await fetch('/api/brands');
      const d = await r.json() as { brands: BrandSummary[] };
      if (d.brands?.length) {
        setBrands(d.brands);
        // Restore or default to first brand
        setActiveBrand(prev => {
          const found = d.brands.find(b => b.id === prev.id) || d.brands[0];
          return found;
        });
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadBrands(); }, [loadBrands]);

  // Clean URLs: tab id (snake_case) ↔ path (kebab-case). /video-studio not /?tab=video_studio
  const changeTab = useCallback((t: TabId) => {
    setTab(t);
    setVisitedTabs(prev => new Set([...prev, t]));
    // pushState keeps the SPA mounted (preserves keep-alive) while giving a real URL
    if (typeof window !== 'undefined') {
      const path = '/' + t.replace(/_/g, '-');
      if (window.location.pathname !== path) window.history.pushState({}, '', path);
    }
  }, []);

  // Sync tab on browser back/forward
  useEffect(() => {
    const onPop = () => {
      const seg = window.location.pathname.replace(/^\//, '').split('/')[0].replace(/-/g, '_');
      const found = TABS.find(t => t.id === seg);
      if (found) { setTab(found.id); setVisitedTabs(prev => new Set([...prev, found.id])); }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const userRole = (session?.user as Record<string, unknown>)?.role as string | undefined;

  useEffect(() => {
    if (userRole !== 'root_admin' && userRole !== 'admin') return;
    fetch('/api/admin/users')
      .then(res => { setPendingCount(Number(res.headers.get('X-Pending-Count') ?? 0)); })
      .catch(() => {});
  }, [userRole]);

  useEffect(() => {
    const handler = () => { if (window.innerWidth >= 768) setDrawerOpen(false); };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  // When brand switches, reset visited tabs so all views remount fresh for new brand
  const prevBrandRef = useRef(activeBrand.id);
  useEffect(() => {
    if (prevBrandRef.current !== activeBrand.id) {
      prevBrandRef.current = activeBrand.id;
      setVisitedTabs(new Set([tab]));
    }
  }, [activeBrand.id, tab]);

  const currentTab  = TABS.find(t => t.id === tab);
  const bid         = activeBrand.id;

  const sidebarProps = {
    tab, changeTab, userRole, pendingCount,
    brands, activeBrand,
    onBrandSwitch: (b: BrandSummary) => setActiveBrand(b),
  };

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-52 flex-shrink-0 border-r border-gray-800 bg-gray-900/50 flex-col sticky top-0 h-screen overflow-y-auto">
        <SidebarContent {...sidebarProps} />
      </aside>

      {/* Mobile overlay */}
      {drawerOpen && <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setDrawerOpen(false)} />}

      {/* Mobile drawer */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 border-r border-gray-800 flex flex-col transform transition-transform duration-200 md:hidden ${
        drawerOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <SidebarContent {...sidebarProps} onClose={() => setDrawerOpen(false)} />
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-10 border-b border-gray-800 bg-gray-950/90 backdrop-blur px-4 h-12 flex items-center gap-3 flex-shrink-0">
          <button className="md:hidden p-1 -ml-1 text-gray-400 hover:text-white rounded"
            onClick={() => setDrawerOpen(true)}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 5h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2z" clipRule="evenodd" />
            </svg>
          </button>

          <span className="text-base leading-none">{currentTab?.icon}</span>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-white leading-tight truncate">{TAB_LABELS[tab]}</h1>
            {/* Active brand badge in header */}
            <p className="text-[10px] text-gray-500 leading-tight hidden sm:block">{activeBrand.name}</p>
          </div>

          <div className="flex-1" />

          {(userRole === 'admin' || userRole === 'root_admin') && (
            <a href="/platform" title="BigAI MKT — Platform Console"
              className="text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg px-2.5 py-1 transition-colors flex items-center gap-1">
              🛰 <span className="hidden sm:inline">Platform</span>
            </a>
          )}

          <HelpDrawer tabId={tab} onOpenFullGuide={() => changeTab('guide')} />

          {session?.user && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gray-700 overflow-hidden flex-shrink-0">
                {session.user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={session.user.image} alt={session.user.name ?? ''} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs font-bold">
                    {(session.user.name ?? session.user.email ?? '?')[0].toUpperCase()}
                  </div>
                )}
              </div>
              <span className="text-xs text-gray-300 truncate max-w-[100px] hidden sm:block">
                {(session.user.name ?? session.user.email ?? '').slice(0, 18)}
              </span>
              <button onClick={() => signOut({ callbackUrl: '/login' })}
                className="text-xs text-gray-500 hover:text-gray-200 transition-colors">
                Sign out
              </button>
            </div>
          )}
        </header>

        {/* Keep visited tabs mounted (hidden when not active) so state is preserved */}
        <main className="flex-1 overflow-hidden relative">
          {TABS.map(({ id }) => {
            if (!visitedTabs.has(id)) return null;
            const isActive = tab === id;
            return (
              <div key={id} className={`absolute inset-0 overflow-auto ${isActive ? '' : 'hidden'}`}>
                {id === 'dashboard'        && <DashboardView brandId={bid} onNavigate={t => changeTab(t as TabId)} />}
                {id === 'brands'           && <BrandsView onSelectBrand={bId => { const b = brands.find(x => x.id === bId); if (b) setActiveBrand(b); changeTab('products'); }} />}
                {id === 'content_templates' && <ContentTemplatesView brandId={bid} />}
                {id === 'scoreboard'       && <ScoreboardView brandId={bid} />}
                {id === 'brand_dna'        && <BrandDnaView brandId={bid} />}
                {id === 'products'         && <ProductsView brandId={bid} />}
                {id === 'plan_calendar'    && <PlanCalendarView brandId={bid} />}
                {id === 'create_studio'    && <CreateStudioView brandId={bid} />}
                {id === 'text_overlay'     && <TextOverlayView brandId={bid} brandName={activeBrand.name} />}
                {id === 'cost'             && <CostView brandId={bid} />}
                {id === 'video_studio'     && <VideoStudioView brandId={bid} />}
                {id === 'inspiration'      && <InspirationView brandId={bid} />}
                {id === 'blog_factory'     && <BlogFactoryView brandId={bid} />}
                {id === 'content_queue'    && <ContentQueueView brandId={bid} />}
                {id === 'publisher'        && <PublisherView fbSuccess={fbSuccess} fbError={fbError} brandId={bid} />}
                {id === 'job_queue'        && <JobQueueView />}
                {id === 'analytics'        && <AnalyticsView brandId={bid} />}
                {id === 'asset_dam'        && <AssetDamView brandId={bid} />}
                {id === 'content_log'      && <ContentLogView brandId={bid} />}
                {id === 'payment'          && <PaymentView />}
                {id === 'inbox'            && <InboxView />}
                {id === 'guide'            && <UserGuideView />}
                {id === 'team'             && <BrandMembersView brandId={bid} brandName={activeBrand.name} />}
              </div>
            );
          })}
        </main>
      </div>
    </div>
  );
}
