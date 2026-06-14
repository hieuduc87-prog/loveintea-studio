'use client';

/** Create Studio — gom 3 công cụ tạo content vào 1: CreateLab · Content Workshop · Image Studio. */

import { useState } from 'react';
import { CreateLabView } from './CreateLabView';
import { ContentWorkshopView } from './ContentWorkshopView';
import { ImageStudioView } from './ImageStudioView';

export function CreateStudioView({ brandId }: { brandId: string }) {
  const [sub, setSub] = useState<'cratelab' | 'workshop' | 'image'>('cratelab');
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-0.5 w-fit m-4 mb-0 flex-shrink-0">
        {([
          ['cratelab', '🧪 CreateLab — thử nhanh'],
          ['workshop', '✍️ Content Workshop — O3'],
          ['image', '🖼️ Image Studio'],
        ] as const).map(([s, label]) => (
          <button key={s} onClick={() => setSub(s)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${sub === s ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {sub === 'cratelab' && <CreateLabView brandId={brandId} />}
        {sub === 'workshop' && <ContentWorkshopView brandId={brandId} />}
        {sub === 'image' && <ImageStudioView brandId={brandId} />}
      </div>
    </div>
  );
}
