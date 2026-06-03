'use client';

import { useState, useCallback } from 'react';
import { BrandDnaView }       from './BrandDnaView';
import { ContentWorkshopView } from './ContentWorkshopView';
import { ImageStudioView }    from './ImageStudioView';
import { ContentQueueView }   from './ContentQueueView';
import { PublisherView }      from './PublisherView';
import { BlogFactoryView }    from './BlogFactoryView';
import { InboxView }          from './InboxView';
import { AnalyticsView }      from './AnalyticsView';
import Image from 'next/image';

type TabId =
  | 'brand_dna'
  | 'content_workshop'
  | 'image_studio'
  | 'content_queue'
  | 'publisher'
  | 'blog_factory'
  | 'inbox'
  | 'analytics';

const TABS: { id: TabId; label: string; icon: string; group: string }[] = [
  { id: 'brand_dna',        label: 'Brand DNA',        icon: '🌿', group: 'Foundation' },
  { id: 'content_workshop', label: 'Content Workshop',  icon: '✍️', group: 'Create' },
  { id: 'image_studio',     label: 'Image Studio',      icon: '🖼️', group: 'Create' },
  { id: 'content_queue',    label: 'Content Queue',     icon: '📋', group: 'Publish' },
  { id: 'publisher',        label: 'Publisher',         icon: '📡', group: 'Publish' },
  { id: 'blog_factory',     label: 'Blog Factory',      icon: '📝', group: 'Publish' },
  { id: 'inbox',            label: 'Inbox & Comments',  icon: '💬', group: 'Community' },
  { id: 'analytics',        label: 'Analytics',         icon: '📊', group: 'Insights' },
];

const GROUPS = ['Foundation', 'Create', 'Publish', 'Community', 'Insights'];

const TAB_LABELS: Record<TabId, string> = {
  brand_dna:        'Brand DNA — Source of Truth',
  content_workshop: 'Content Workshop',
  image_studio:     'Image Studio',
  content_queue:    'Content Queue',
  publisher:        'Publisher — FB & IG',
  blog_factory:     'Blog Factory',
  inbox:            'Inbox & Comments',
  analytics:        'Analytics',
};

export function AppShell() {
  const [tab, setTab] = useState<TabId>('content_workshop');

  const changeTab = useCallback((t: TabId) => setTab(t), []);

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Sidebar */}
      <aside className="w-52 flex-shrink-0 border-r border-gray-800 bg-gray-900/50 flex flex-col sticky top-0 h-screen overflow-y-auto">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-gray-800 flex-shrink-0">
          <button onClick={() => changeTab('brand_dna')} className="flex items-center gap-2.5 w-full hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden bg-brand-600 flex-shrink-0">
              <Image src="/brand/logos/logo-white.png" alt="LoveinTea" width={28} height={28} className="object-contain" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-white text-sm leading-tight truncate">LoveinTea</div>
              <div className="text-[10px] text-gray-500 leading-tight">Studio</div>
            </div>
          </button>
        </div>

        {/* Nav */}
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
                    onClick={() => changeTab(t.id)}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors text-left ${
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

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-800 flex-shrink-0">
          <p className="text-[10px] text-gray-600">loveintea.wealthpsy.com</p>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-10 border-b border-gray-800 bg-gray-950/80 backdrop-blur px-6 h-12 flex items-center gap-3 flex-shrink-0">
          <span className="text-lg leading-none">{TABS.find(t => t.id === tab)?.icon}</span>
          <h1 className="text-sm font-semibold text-white">{TAB_LABELS[tab]}</h1>
        </header>
        <main className="flex-1 overflow-auto">
          {tab === 'brand_dna'        && <BrandDnaView />}
          {tab === 'content_workshop' && <ContentWorkshopView />}
          {tab === 'image_studio'     && <ImageStudioView />}
          {tab === 'content_queue'    && <ContentQueueView />}
          {tab === 'publisher'        && <PublisherView />}
          {tab === 'blog_factory'     && <BlogFactoryView />}
          {tab === 'inbox'            && <InboxView />}
          {tab === 'analytics'        && <AnalyticsView />}
        </main>
      </div>
    </div>
  );
}
