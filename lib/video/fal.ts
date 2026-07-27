/**
 * fal.ai queue client — REST thuần (không SDK) cho 3 model đã verify 27/07/2026:
 *  - fal-ai/flux/schnell                                ($0.003/MP)   — t2i frame gốc
 *  - fal-ai/minimax/hailuo-02/standard/image-to-video   ($0.045/s)    — i2v 6s 768P
 *  - fal-ai/elevenlabs/sound-effects/v2                 ($0.002/s)    — SFX ASMR
 * Queue: POST https://queue.fal.run/<model> → {request_id,status_url,response_url}
 * → poll status tới COMPLETED → GET response_url → tải file url về buffer.
 */

const FAL_QUEUE = 'https://queue.fal.run';

/** ── Cost ledger — đếm CALL THẬT × đơn giá đã verify (fal.ai pricing 27/07/2026).
 *  Render chạy 1-at-a-time (scheduler) nên tally global theo run là an toàn. */
export interface FalCost { model: string; qty: string; usd: number; at: string }
let costLog: FalCost[] = [];
export function resetFalCostLog(): void { costLog = []; }
export function getFalCostLog(): { items: FalCost[]; totalUsd: number } {
  return { items: [...costLog], totalUsd: Math.round(costLog.reduce((a, c) => a + c.usd, 0) * 10000) / 10000 };
}
function recordCost(model: string, qty: string, usd: number): void {
  costLog.push({ model, qty, usd: Math.round(usd * 10000) / 10000, at: new Date().toISOString() });
}

function falKey(): string {
  const k = process.env.FAL_KEY;
  if (!k) throw new Error('FAL_KEY chưa cấu hình trong env');
  return k;
}

interface QueueSubmit { request_id: string; status_url?: string; response_url?: string }

async function falFetch(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Key ${falKey()}`, 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  return res;
}

/** Submit → poll → result. timeoutMs mặc định 6 phút (i2v thường 1-3 phút). */
export async function falRun<T>(model: string, input: unknown, timeoutMs = 360_000): Promise<T> {
  const sub = await falFetch(`${FAL_QUEUE}/${model}`, { method: 'POST', body: JSON.stringify(input) });
  if (!sub.ok) throw new Error(`fal submit ${model} ${sub.status}: ${(await sub.text()).slice(0, 300)}`);
  const q = await sub.json() as QueueSubmit;
  const statusUrl = q.status_url || `${FAL_QUEUE}/${model}/requests/${q.request_id}/status`;
  const responseUrl = q.response_url || `${FAL_QUEUE}/${model}/requests/${q.request_id}`;

  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (Date.now() > deadline) throw new Error(`fal timeout ${model} sau ${Math.round(timeoutMs / 1000)}s`);
    await new Promise(r => setTimeout(r, 4000));
    const st = await falFetch(statusUrl);
    if (!st.ok) continue; // transient — poll tiếp tới deadline
    const s = await st.json() as { status: string; error?: unknown };
    if (s.status === 'COMPLETED') break;
    if (s.status === 'FAILED' || s.status === 'CANCELLED') {
      throw new Error(`fal ${model} ${s.status}: ${JSON.stringify(s.error ?? '').slice(0, 300)}`);
    }
  }
  const out = await falFetch(responseUrl);
  if (!out.ok) throw new Error(`fal result ${model} ${out.status}`);
  return await out.json() as T;
}

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fal file download ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** FLUX schnell t2i — trả PNG buffer. Kích thước 9:16 ≈ 1MP để giá $0.003. */
export async function falImage(prompt: string, width = 768, height = 1344): Promise<Buffer> {
  const out = await falRun<{ images: Array<{ url: string }> }>('fal-ai/flux/schnell', {
    prompt, image_size: { width, height }, num_inference_steps: 4, num_images: 1,
    enable_safety_checker: true, output_format: 'png',
  }, 120_000);
  const url = out.images?.[0]?.url;
  if (!url) throw new Error('fal flux: không có ảnh trả về');
  // FLUX schnell: $0.003/MP, làm tròn LÊN theo MP (fal pricing)
  const mp = Math.ceil((width * height) / 1_000_000);
  recordCost('flux/schnell', `${width}x${height} (${mp}MP)`, 0.003 * mp);
  return download(url);
}

/** Hailuo 02 standard i2v — 6s 768P từ 1 frame gốc. Ảnh gửi dạng data URI. */
export async function falImageToVideo(imagePng: Buffer, prompt: string): Promise<Buffer> {
  const dataUri = `data:image/png;base64,${imagePng.toString('base64')}`;
  // 12 phút: Hailuo giờ cao điểm có thể xếp hàng lâu (thực tế 27/07: >6 phút)
  const out = await falRun<{ video: { url: string } }>('fal-ai/minimax/hailuo-02/standard/image-to-video', {
    prompt, image_url: dataUri, duration: '6', resolution: '768P', prompt_optimizer: true,
  }, 720_000);
  const url = out.video?.url;
  if (!url) throw new Error('fal hailuo: không có video trả về');
  // Hailuo-02 standard 768P: $0.045/s × 6s = $0.27/clip (fal pricing)
  recordCost('hailuo-02/i2v', '6s 768P', 0.045 * 6);
  return download(url);
}

/** ElevenLabs sound-effects v2 — SFX/BGM ngắn. Trả MP3 buffer. */
export async function falSfx(text: string, durationSeconds: number): Promise<Buffer> {
  const out = await falRun<{ audio: { url: string } }>('fal-ai/elevenlabs/sound-effects/v2', {
    text, duration_seconds: Math.max(0.5, Math.min(22, durationSeconds)),
  }, 120_000);
  const url = out.audio?.url;
  if (!url) throw new Error('fal sfx: không có audio trả về');
  const secs = Math.max(0.5, Math.min(22, durationSeconds));
  recordCost('elevenlabs/sfx-v2', `${secs.toFixed(1)}s`, 0.002 * secs);
  return download(url);
}

/** Dịch lỗi fal sang tiếng Việt thân thiện (pattern friendlyImageError 22/07). */
export function friendlyFalError(e: unknown): string {
  const msg = String(e instanceof Error ? e.message : e);
  const low = msg.toLowerCase();
  if (low.includes('fal_key') || low.includes('unauthorized') || low.includes('401'))
    return 'Chưa cấu hình hoặc sai FAL_KEY — founder kiểm tra fal.ai dashboard → Keys.';
  if (low.includes('exhausted') || low.includes('balance') || low.includes('402'))
    return 'Tài khoản fal.ai hết credit — founder nạp thêm tại fal.ai/dashboard/billing.';
  if (low.includes('timeout')) return `Model AI xử lý quá lâu (${msg.slice(0, 80)}) — thử lại, giờ cao điểm có thể chậm.`;
  if (low.includes('content') && (low.includes('policy') || low.includes('safety')))
    return 'Prompt bị chặn bởi bộ lọc an toàn của model — đổi cách mô tả cảnh.';
  return msg.slice(0, 300);
}
