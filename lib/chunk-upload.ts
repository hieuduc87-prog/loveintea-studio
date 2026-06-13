/**
 * Browser-side chunked upload (works around Cloudflare 100MB request limit).
 * Splits the file into 4MB chunks and POSTs them sequentially to /api/upload/chunk.
 */
export interface ChunkResult { ok?: boolean; kind?: string; id?: string; url?: string; status?: string; error?: string }

const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB — safely under the 100MB CF limit

export async function chunkedUpload(
  file: File,
  purpose: 'product_media' | 'bgm_video',
  extra: Record<string, string> = {},
  onProgress?: (pct: number) => void,
): Promise<ChunkResult> {
  const uploadId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const total = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));

  let last: ChunkResult = {};
  for (let index = 0; index < total; index++) {
    const blob = file.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE);
    const fd = new FormData();
    fd.append('uploadId', uploadId);
    fd.append('index', String(index));
    fd.append('total', String(total));
    fd.append('name', file.name);
    fd.append('purpose', purpose);
    for (const [k, v] of Object.entries(extra)) fd.append(k, v);
    fd.append('chunk', blob, 'chunk');

    const r = await fetch('/api/upload/chunk', { method: 'POST', body: fd });
    last = await r.json() as ChunkResult;
    if (!r.ok || last.error) throw new Error(last.error || `Upload failed at chunk ${index + 1}/${total}`);
    onProgress?.(Math.round(((index + 1) / total) * 100));
  }
  return last;
}
