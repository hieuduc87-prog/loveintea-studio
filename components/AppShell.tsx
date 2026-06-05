'use client';

import { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { KanbanSquare, GitBranch, Users } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import { BrandDnaView }       from './BrandDnaView';
import { ProductsView }      from './ProductsView';
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
import { UserGuideView }     from './UserGuideView';

type TabId =
  | 'brand_dna' | 'products'
  | 'import_plan' | 'calendar' | 'schedule'
  | 'content_workshop' | 'image_studio' | 'blog_factory'
  | 'content_queue' | 'image_library' | 'publisher' | 'job_queue'
  | 'analytics'
  | 'inbox'
  | 'guide';

const TABS: { id: TabId; label: string; icon: string; group: string }[] = [
  // Strategy
  { id: 'brand_dna',        label: 'Brand DNA',        icon: '🌿', group: 'Strategy' },
  { id: 'products',         label: 'Products',         icon: '📦', group: 'Strategy' },
  // Plan
  { id: 'import_plan',      label: 'Content Plans',    icon: '📋', group: 'Plan' },
  { id: 'calendar',         label: 'Post Calendar',    icon: '🗓️', group: 'Plan' },
  { id: 'schedule',         label: 'Schedule',          icon: '📅', group: 'Plan' },
  // Create
  { id: 'content_workshop', label: 'Content Workshop', icon: '✍️', group: 'Create' },
  { id: 'image_studio',     label: 'Image Studio',     icon: '🖼️', group: 'Create' },
  { id: 'blog_factory',     label: 'Blog Factory',     icon: '📝', group: 'Create' },
  // Publish
  { id: 'content_queue',    label: 'Queue',            icon: '📋', group: 'Publish' },
  { id: 'publisher',        label: 'Channels',         icon: '📡', group: 'Publish' },
  { id: 'job_queue',        label: 'Job Queue',        icon: '⏳', group: 'Publish' },
  // Measure
  { id: 'analytics',        label: 'Analytics',        icon: '📊', group: 'Measure' },
  // Library
  { id: 'image_library',    label: 'Image Library',    icon: '🗃️', group: 'Library' },
  { id: 'inbox',            label: 'Inbox',            icon: '💬', group: 'Library' },
  // Guide
  { id: 'guide',            label: 'Hướng dẫn',       icon: '📖', group: 'Help' },
];

const GROUPS = ['Strategy', 'Plan', 'Create', 'Publish', 'Measure', 'Library', 'Help'];

const TAB_LABELS: Record<TabId, string> = Object.fromEntries(TABS.map(t => [t.id, t.label])) as Record<TabId, string>;

function SidebarContent({ tab, changeTab, onClose, userRole }: {
  tab: TabId; changeTab: (t: TabId) => void; onClose?: () => void; userRole?: string;
}) {
  return (
    <>
      {/* Brand header */}
      <div className="px-4 py-4 border-b border-gray-800 flex-shrink-0">
        <button onClick={() => { changeTab('brand_dna'); onClose?.(); }}
          className="flex items-center gap-2.5 w-full hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden bg-brand-600 flex-shrink-0">
            <Image src="/brand/logos/logo-white.png" alt="LoveinTea" width={28} height={28} className="object-contain" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-white text-sm leading-tight truncate">LoveinTea</div>
            <div className="text-[10px] text-gray-500 leading-tight">Marketing Studio</div>
          </div>
        </button>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-3 overflow-y-auto">
        {/* Kanban — trang riêng */}
        <div>
          <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-600">Dự án</p>
          <Link
            href="/kanban"
            onClick={() => onClose?.()}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <KanbanSquare size={16} className="flex-shrink-0" />
            <span className="truncate">Kanban</span>
          </Link>
          <Link
            href="/flow-builder"
            onClick={() => onClose?.()}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <GitBranch size={16} className="flex-shrink-0" />
            <span className="truncate">Flow Builder</span>
          </Link>
        </div>

        {GROUPS.map(group => {
          const items = TABS.filter(t => t.group === group);
          if (!items.length) return null;
          return (
            <div key={group}>
              <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-600">{group}</p>
              {items.map(t => (
                <button key={t.id}
                  onClick={() => { changeTab(t.id); onClose?.(); }}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors text-left ${
                    tab === t.id
                      ? 'bg-brand-600/20 text-white font-medium'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}>
                  <span className="text-base leading-none w-5 text-center flex-shrink-0">{t.icon}</span>
                  <span className="truncate">{t.label}</span>
                </button>
              ))}
            </div>
          );
        })}

      </nav>
      {/* Admin link */}
      {userRole === 'admin' && (
        <div className="px-2 pb-1 flex-shrink-0">
          <Link
            href="/admin/users"
            onClick={() => onClose?.()}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <Users size={16} className="flex-shrink-0" />
            <span className="truncate">Users</span>
          </Link>
        </div>
      )}

      <div className="px-4 py-3 border-t border-gray-800 flex-shrink-0">
        <p className="text-[10px] text-gray-600">loveintea.wealthpsy.com</p>
      </div>
    </>
  );
}

export function AppShell() {
  const [tab, setTab] = useState<TabId>('content_workshop');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data: session } = useSession();

  const changeTab = useCallback((t: TabId) => setTab(t), []);
  const userRole = (session?.user as any)?.role as string | undefined;

  useEffect(() => {
    const handler = () => { if (window.innerWidth >= 768) setDrawerOpen(false); };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  const currentTab = TABS.find(t => t.id === tab);

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-52 flex-shrink-0 border-r border-gray-800 bg-gray-900/50 flex-col sticky top-0 h-screen overflow-y-auto">
        <SidebarContent tab={tab} changeTab={changeTab} userRole={userRole} />
      </aside>

      {/* Mobile overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setDrawerOpen(false)} />
      )}

      {/* Mobile drawer */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 border-r border-gray-800 flex flex-col transform transition-transform duration-200 md:hidden ${
        drawerOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <SidebarContent tab={tab} changeTab={changeTab} onClose={() => setDrawerOpen(false)} userRole={userRole} />
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-10 border-b border-gray-800 bg-gray-950/90 backdrop-blur px-4 h-12 flex items-center gap-3 flex-shrink-0">
          <button className="md:hidden p-1 -ml-1 text-gray-400 hover:text-white rounded"
            onClick={() => setDrawerOpen(true)} aria-label="Open menu">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 5h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2z" clipRule="evenodd" />
            </svg>
          </button>
          <span className="text-lg leading-none">{currentTab?.icon}</span>
          <h1 className="text-sm font-semibold text-white truncate">{TAB_LABELS[tab]}</h1>

          {/* Spacer */}
          <div className="flex-1" />

          {/* User avatar + sign out */}
          {session?.user && (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-gray-700 overflow-hidden flex-shrink-0">
                {session.user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={session.user.image}
                    alt={session.user.name ?? ''}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs font-bold">
                    {(session.user.name ?? session.user.email ?? '?')[0].toUpperCase()}
                  </div>
                )}
              </div>
              <span className="text-xs text-gray-300 truncate max-w-[120px] hidden sm:block">
                {(session.user.name ?? session.user.email ?? '').slice(0, 20)}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="text-xs text-gray-500 hover:text-gray-200 transition-colors"
              >
                Sign out
              </button>
            </div>
          )}
        </header>

        <main className="flex-1 overflow-auto">
          {tab === 'brand_dna'        && <BrandDnaView />}
          {tab === 'products'         && <ProductsView />}
          {tab === 'import_plan'      && <ContentPlansView />}
          {tab === 'calendar'         && <CalendarView />}
          {tab === 'schedule'         && <ScheduleView />}
          {tab === 'content_workshop' && <ContentWorkshopView />}
          {tab === 'image_studio'     && <ImageStudioView />}
          {tab === 'blog_factory'     && <BlogFactoryView />}
          {tab === 'content_queue'    && <ContentQueueView />}
          {tab === 'publisher'        && <PublisherView />}
          {tab === 'job_queue'        && <JobQueueView />}
          {tab === 'analytics'        && <AnalyticsView />}
          {tab === 'image_library'    && <ImageLibraryView />}
          {tab === 'inbox'            && <InboxView />}
          {tab === 'guide'            && <UserGuideView />}
        </main>
      </div>
    </div>
  );
}
