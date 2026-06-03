'use client';

import { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { BrandDnaView }       from './BrandDnaView';
import { ContentWorkshopView } from './ContentWorkshopView';
import { ImageStudioView }    from './ImageStudioView';
import { ImageLibraryView }   from './ImageLibraryView';
import { JobQueueView }       from './JobQueueView';
import { ContentQueueView }   from './ContentQueueView';
import { PublisherView }      from './PublisherView';
import { BlogFactoryView }    from './BlogFactoryView';
import { InboxView }          from './InboxView';
import { AnalyticsView }      from './AnalyticsView';
import { ScheduleView }      from './ScheduleView';

type TabId =
  | 'brand_dna'
  | 'content_workshop'
  | 'image_studio'
  | 'image_library'
  | 'job_queue'
  | 'content_queue'
  | 'schedule'
  | 'publisher'
  | 'blog_factory'
  | 'inbox'
  | 'analytics';

const TABS: { id: TabId; label: string; icon: string; group: string }[] = [
  { id: 'brand_dna',        label: 'Brand DNA',        icon: '🌿', group: 'Foundation' },
  { id: 'content_workshop', label: 'Content Workshop',  icon: '✍️', group: 'Create' },
  { id: 'image_studio',     label: 'Image Studio',      icon: '🖼️', group: 'Create' },
  { id: 'image_library',   label: 'Image Library',     icon: '🗃️', group: 'Create' },
  { id: 'job_queue',        label: 'Job Queue',         icon: '⚙️', group: 'Create' },
  { id: 'content_queue',    label: 'Content Queue',     icon: '📋', group: 'Publish' },
  { id: 'schedule',         label: 'Schedule',          icon: '📅', group: 'Publish' },
  { id: 'publisher',        label: 'FB Setup',          icon: '🔑', group: 'Publish' },
  { id: 'blog_factory',     label: 'Blog Factory',      icon: '📝', group: 'Publish' },
  { id: 'inbox',            label: 'Inbox & Comments',  icon: '💬', group: 'Community' },
  { id: 'analytics',        label: 'Analytics',         icon: '📊', group: 'Insights' },
];

const GROUPS = ['Foundation', 'Create', 'Publish', 'Community', 'Insights'];

const TAB_LABELS: Record<TabId, string> = {
  brand_dna:        'Brand DNA',
  content_workshop: 'Content Workshop',
  image_studio:     'Image Studio',
  image_library:    'Image Library',
  job_queue:        'Job Queue',
  content_queue:    'Content Queue',
  schedule:         'Schedule',
  publisher:        'FB Setup',
  blog_factory:     'Blog Factory',
  inbox:            'Inbox & Comments',
  analytics:        'Analytics',
};

function SidebarContent({ tab, changeTab, onClose }: {
  tab: TabId;
  changeTab: (t: TabId) => void;
  onClose?: () => void;
}) {
  return (
    <>
      <div className="px-4 py-4 border-b border-gray-800 flex-shrink-0">
        <button onClick={() => { changeTab('brand_dna'); onClose?.(); }}
          className="flex items-center gap-2.5 w-full hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden bg-brand-600 flex-shrink-0">
            <Image src="/brand/logos/logo-white.png" alt="LoveinTea" width={28} height={28} className="object-contain" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-white text-sm leading-tight truncate">LoveinTea</div>
            <div className="text-[10px] text-gray-500 leading-tight">Studio</div>
          </div>
        </button>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-4 overflow-y-auto">
        {GROUPS.map(group => {
          const items = TABS.filter(t => t.group === group);
          if (!items.length) return null;
          return (
            <div key={group}>
              <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-600">{group}</p>
              {items.map(t => (
                <button
                  key={t.id}
                  onClick={() => { changeTab(t.id); onClose?.(); }}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-sm transition-colors text-left ${
                    tab === t.id
                      ? 'bg-brand-600/20 text-white font-medium'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <span className="text-base leading-none w-5 text-center flex-shrink-0">{t.icon}</span>
                  <span className="truncate">{t.label}</span>
                </button>
              ))}
            </div>
          );
        })}
      </nav>

      <div className="px-4 py-3 border-t border-gray-800 flex-shrink-0">
        <p className="text-[10px] text-gray-600">loveintea.wealthpsy.com</p>
      </div>
    </>
  );
}

export function AppShell() {
  const [tab, setTab] = useState<TabId>('content_workshop');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const changeTab = useCallback((t: TabId) => setTab(t), []);

  // Close drawer on resize to desktop
  useEffect(() => {
    const handler = () => { if (window.innerWidth >= 768) setDrawerOpen(false); };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Prevent body scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  const currentTab = TABS.find(t => t.id === tab);

  return (
    <div className="min-h-screen bg-gray-950 flex">

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-52 flex-shrink-0 border-r border-gray-800 bg-gray-900/50 flex-col sticky top-0 h-screen overflow-y-auto">
        <SidebarContent tab={tab} changeTab={changeTab} />
      </aside>

      {/* Mobile Drawer Overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 border-r border-gray-800 flex flex-col transform transition-transform duration-200 md:hidden ${
        drawerOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <SidebarContent tab={tab} changeTab={changeTab} onClose={() => setDrawerOpen(false)} />
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-10 border-b border-gray-800 bg-gray-950/90 backdrop-blur px-4 h-12 flex items-center gap-3 flex-shrink-0">
          {/* Hamburger — mobile only */}
          <button
            className="md:hidden p-1 -ml-1 text-gray-400 hover:text-white rounded"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 5h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2z" clipRule="evenodd" />
            </svg>
          </button>
          <span className="text-lg leading-none">{currentTab?.icon}</span>
          <h1 className="text-sm font-semibold text-white truncate">{TAB_LABELS[tab]}</h1>
        </header>

        <main className="flex-1 overflow-auto">
          {tab === 'brand_dna'        && <BrandDnaView />}
          {tab === 'content_workshop' && <ContentWorkshopView />}
          {tab === 'image_studio'     && <ImageStudioView />}
          {tab === 'image_library'    && <ImageLibraryView />}
          {tab === 'job_queue'        && <JobQueueView />}
          {tab === 'content_queue'    && <ContentQueueView />}
          {tab === 'schedule'         && <ScheduleView />}
          {tab === 'publisher'        && <PublisherView />}
          {tab === 'blog_factory'     && <BlogFactoryView />}
          {tab === 'inbox'            && <InboxView />}
          {tab === 'analytics'        && <AnalyticsView />}
        </main>
      </div>
    </div>
  );
}
