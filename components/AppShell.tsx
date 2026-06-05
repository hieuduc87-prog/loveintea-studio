'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { KanbanSquare, GitBranch } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { BrandDnaView }       from './BrandDnaView';
import { ProductsView }       from './ProductsView';
import { ContentWorkshopView } from './ContentWorkshopView';
import { ImageStudioView }    from './ImageStudioView';
import { ImageLibraryView }   from './ImageLibraryView';
import { JobQueueView }       from './JobQueueView';
import { ContentQueueView }   from './ContentQueueView';
import { PublisherView }      from './PublisherView';
import { BlogFactoryView }    from './BlogFactoryView';
import { InboxView }          from './InboxView';
import { AnalyticsView }      from './AnalyticsView';
import { ScheduleView }       from './ScheduleView';
import { ContentPlansView }   from './ContentPlansView';
import { CalendarView }       from './CalendarView';
import { UserGuideView }      from './UserGuideView';
import { UserManagementView } from './UserManagementView';
import { AssetDamView }       from './AssetDamView';
import { ContentLogView }     from './ContentLogView';
import { PaymentView }        from './PaymentView';
import { BrandsView }         from './BrandsView';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BrandSummary {
  id: string; name: string; slug: string;
  logo_url: string | null; domain: string | null; product_count: number;
}

type TabId =
  | 'brands' | 'brand_dna' | 'products'
  | 'import_plan' | 'calendar' | 'schedule'
  | 'content_workshop' | 'image_studio' | 'blog_factory'
  | 'content_queue' | 'image_library' | 'publisher' | 'job_queue'
  | 'analytics'
  | 'inbox'
  | 'asset_dam' | 'content_log'
  | 'payment'
  | 'guide' | 'team';

const TABS: { id: TabId; label: string; icon: string; group: string }[] = [
  // Strategy (per brand)
  { id: 'brand_dna',        label: 'Brand DNA',        icon: '🌿', group: 'Strategy' },
  { id: 'products',         label: 'Products',         icon: '📦', group: 'Strategy' },
  // Plan
  { id: 'import_plan',      label: 'Content Plans',    icon: '📋', group: 'Plan' },
  { id: 'calendar',         label: 'Post Calendar',    icon: '🗓️', group: 'Plan' },
  { id: 'schedule',         label: 'Schedule',         icon: '📅', group: 'Plan' },
  // Create
  { id: 'content_workshop', label: 'Content Workshop', icon: '✍️', group: 'Create' },
  { id: 'image_studio',     label: 'Image Studio',     icon: '🖼️', group: 'Create' },
  { id: 'blog_factory',     label: 'Blog Factory',     icon: '📝', group: 'Create' },
  // Publish
  { id: 'content_queue',   label: 'Queue',             icon: '📋', group: 'Publish' },
  { id: 'publisher',        label: 'Channels',         icon: '📡', group: 'Publish' },
  { id: 'job_queue',        label: 'Job Queue',        icon: '⏳', group: 'Publish' },
  // Measure
  { id: 'analytics',        label: 'Analytics',        icon: '📊', group: 'Measure' },
  // Library
  { id: 'asset_dam',        label: 'Asset DAM',        icon: '🗃️', group: 'Library' },
  { id: 'image_library',    label: 'Image Library',    icon: '🖼️', group: 'Library' },
  { id: 'content_log',      label: 'Content Log',      icon: '📜', group: 'Library' },
  { id: 'inbox',            label: 'Inbox',            icon: '💬', group: 'Library' },
  // Billing
  { id: 'payment',          label: 'Thanh Toán',       icon: '💳', group: 'Billing' },
  // Help
  { id: 'guide',            label: 'Hướng dẫn',       icon: '📖', group: 'Help' },
  { id: 'team',             label: 'Team & Access',    icon: '👥', group: 'Help' },
  // Hidden — accessible but not in sidebar nav
  { id: 'brands',           label: 'Manage Brands',    icon: '🏷️', group: '_hidden' },
];

const NAV_GROUPS = ['Strategy', 'Plan', 'Create', 'Publish', 'Measure', 'Library', 'Billing', 'Help'];

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
          <div className="w-5 h-5 rounded bg-brand-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-[10px] font-bold">M</span>
          </div>
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Marketing Hub</span>
        </div>
        <BrandDropdown
          brands={brands}
          activeBrand={activeBrand}
          onSwitch={b => { onBrandSwitch(b); onClose?.(); }}
          onManage={() => { changeTab('brands'); onClose?.(); }}
        />
      </div>

      <nav className="flex-1 px-2 py-2 space-y-3 overflow-y-auto">
        {/* External links */}
        <div>
          <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-600">Projects</p>
          <Link href="/kanban" onClick={() => onClose?.()}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
            <KanbanSquare size={14} className="flex-shrink-0" />
            <span>Kanban</span>
          </Link>
          <Link href="/flow-builder" onClick={() => onClose?.()}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
            <GitBranch size={14} className="flex-shrink-0" />
            <span>Flow Builder</span>
          </Link>
        </div>

        {NAV_GROUPS.map(group => {
          const items = TABS.filter(t => t.group === group);
          if (!items.length) return null;
          return (
            <div key={group}>
              <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-600">{group}</p>
              {items.filter(t => {
                if (t.id === 'team') return userRole === 'root_admin' || userRole === 'admin';
                return true;
              }).map(t => (
                <button key={t.id}
                  onClick={() => { changeTab(t.id); onClose?.(); }}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors text-left ${
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
        <p className="text-[10px] text-gray-600">marketing-hub.wealthpsy.com</p>
      </div>
    </>
  );
}

// ─── AppShell ─────────────────────────────────────────────────────────────────

export function AppShell({ initialTab, fbSuccess, fbError }: {
  initialTab?: string; fbSuccess?: boolean; fbError?: string;
}) {
  const validInitialTab = TABS.find(t => t.id === initialTab) ? (initialTab as TabId) : null;
  const [tab, setTab]           = useState<TabId>(validInitialTab || 'products');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Brand state
  const [brands, setBrands]           = useState<BrandSummary[]>([]);
  const [activeBrand, setActiveBrand] = useState<BrandSummary>({
    id: 'loveintea', name: 'LoveinTea', slug: 'loveintea',
    logo_url: null, domain: null, product_count: 0,
  });

  const { data: session } = useSession();
  const router = useRouter();

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

  const changeTab = useCallback((t: TabId) => {
    setTab(t);
    router.push(`/?tab=${t}`, { scroll: false });
  }, [router]);

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

        <main className="flex-1 overflow-auto">
          {tab === 'brands'           && <BrandsView onSelectBrand={id => { const b = brands.find(x => x.id === id); if (b) setActiveBrand(b); changeTab('products'); }} />}
          {tab === 'brand_dna'        && <BrandDnaView brandId={bid} />}
          {tab === 'products'         && <ProductsView brandId={bid} />}
          {tab === 'import_plan'      && <ContentPlansView brandId={bid} />}
          {tab === 'calendar'         && <CalendarView brandId={bid} />}
          {tab === 'schedule'         && <ScheduleView brandId={bid} />}
          {tab === 'content_workshop' && <ContentWorkshopView brandId={bid} />}
          {tab === 'image_studio'     && <ImageStudioView brandId={bid} />}
          {tab === 'blog_factory'     && <BlogFactoryView brandId={bid} />}
          {tab === 'content_queue'    && <ContentQueueView brandId={bid} />}
          {tab === 'publisher'        && <PublisherView fbSuccess={fbSuccess} fbError={fbError} />}
          {tab === 'job_queue'        && <JobQueueView />}
          {tab === 'analytics'        && <AnalyticsView brandId={bid} />}
          {tab === 'asset_dam'        && <AssetDamView brandId={bid} />}
          {tab === 'image_library'    && <ImageLibraryView brandId={bid} />}
          {tab === 'content_log'      && <ContentLogView brandId={bid} />}
          {tab === 'payment'          && <PaymentView />}
          {tab === 'inbox'            && <InboxView />}
          {tab === 'guide'            && <UserGuideView />}
          {tab === 'team'             && <UserManagementView />}
        </main>
      </div>
    </div>
  );
}
