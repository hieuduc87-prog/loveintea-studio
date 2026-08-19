export const dynamic = 'force-dynamic';
export const maxDuration = 30;
/**
 * POST /api/help/ask { question, activeView?, brandId? }
 * Chatbot trợ giúp: Gemini đọc docs/huong-dan-su-dung-video.md + brand_dna + activeView
 * → trả lời tiếng Việt step-by-step. Rate-limit + quota để tránh spam.
 * Không giải quyết được → user tự bấm "escalate" ở UI (không quyết định thay user).
 */
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getBrandId } from '@/lib/brand-guard';
import { generateCaption } from '@/lib/gemini';
import { enforceRateLimit } from '@/lib/rate-limit';

// Cache docs 1 lần (tránh đọc file mỗi request)
let _DOC_CACHE = '';
function loadDocs(): string {
  if (_DOC_CACHE) return _DOC_CACHE;
  const docDir = path.join(process.cwd(), 'docs');
  // Tài liệu cho bot: HD tổng quan (mọi feature) + HD video chi tiết
  const files = ['huong-dan-app.md', 'huong-dan-su-dung-video.md'];
  const chunks: string[] = [];
  for (const f of files) {
    try {
      const p = path.join(docDir, f);
      if (fs.existsSync(p)) chunks.push(`## ${f}\n\n${fs.readFileSync(p, 'utf8')}`);
    } catch { /* ignore */ }
  }
  _DOC_CACHE = chunks.join('\n\n---\n\n').slice(0, 40000); // giới hạn context
  return _DOC_CACHE;
}

const VIEW_LABEL: Record<string, string> = {
  dashboard: 'Dashboard tổng quan',
  brand_dna: 'Brand DNA',
  products: 'Sản phẩm',
  content_templates: 'Content Templates',
  create_studio: 'Tạo Content',
  text_overlay: 'Chữ lên ảnh',
  video_studio: 'Video Studio',
  reel_factory: 'Reel Factory',
  content_queue: 'Review & Queue',
  publisher: 'Publisher',
  analytics: 'Analytics',
  scoreboard: 'Scoreboard',
  guide: 'Hướng dẫn A-Z',
};

export async function POST(req: NextRequest) {
  const brandId = getBrandId(req);
  const limited = enforceRateLimit(req, { scope: 'help-ask', limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { question, activeView } = await req.json() as { question?: string; activeView?: string; brandId?: string };
    const q = (question || '').trim();
    if (!q) return NextResponse.json({ error: 'Câu hỏi trống' }, { status: 400 });
    if (q.length > 500) return NextResponse.json({ error: 'Câu hỏi tối đa 500 ký tự' }, { status: 400 });

    const docs = loadDocs();
    const viewCtx = activeView && VIEW_LABEL[activeView] ? `Người dùng đang ở màn hình: **${VIEW_LABEL[activeView]}**.` : '';

    const prompt = `Bạn là trợ lý tiếng Việt của SaaS "Easy Creative Hub" — công cụ marketing AI cho F&B/DTC. Trả lời câu hỏi của user dựa TRUNG THÀNH trên tài liệu hướng dẫn dưới, KHÔNG bịa tính năng không có.

Trả lời quy tắc:
1. Ngắn gọn, tối đa 4 câu hoặc 4 gạch đầu dòng.
2. Nếu có bước cụ thể → viết dạng "Bước 1: … Bước 2: …"
3. Nếu tài liệu KHÔNG có câu trả lời → nói thẳng "Mình chưa có tài liệu về vấn đề này, bạn bấm nút 'tạo yêu cầu hỗ trợ' bên dưới để đội kỹ thuật giúp." — KHÔNG BỊA.
4. Nói tiếng Việt, tự nhiên, không format markdown code (chat plain text).

${viewCtx}

Câu hỏi: ${q}

TÀI LIỆU HƯỚNG DẪN (chỉ dùng nội dung trong đây):
${docs}
`;

    const answer = await generateCaption(prompt);
    return NextResponse.json({ answer: answer.slice(0, 1500), brandId });
  } catch (e) {
    console.error('[api] help/ask', e);
    return NextResponse.json({ error: 'Xin lỗi, mình chưa trả lời được — thử lại nhé.' }, { status: 500 });
  }
}
