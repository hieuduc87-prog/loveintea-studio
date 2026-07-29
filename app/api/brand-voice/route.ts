export const dynamic = 'force-dynamic';
/**
 * Brand voice override (file .txt/.md/.docx) — THEO TỪNG BRAND.
 *
 * Sự cố (card 2b3d5193, 29/07): upload cho Gossby thì Loveintea cũng đổi theo.
 * Root cause: lưu vào settings với key CỐ ĐỊNH 'brand_voice' — không mang brand
 * nào cả, nên mọi tenant dùng chung 1 bản và ghi đè lẫn nhau (cùng lớp lỗi với
 * image_library/blog_posts thiếu cột brand_id đã fix 21/07 — chỗ này bị sót).
 * Fix: key `brand_voice:<brandId>`, brand lấy từ header tin cậy (getBrandId).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getBrandId } from '@/lib/brand-guard';

/** Key theo brand. Không có brand → từ chối (không rơi về key dùng chung). */
function voiceKey(brandId: string): string {
  return `brand_voice:${brandId}`;
}

export async function GET(req: NextRequest) {
  const brandId = getBrandId(req);
  if (!brandId) return NextResponse.json({ content: '', error: 'Thiếu brand' }, { status: 400 });
  const db = getDb();
  const row = db.prepare('SELECT value, updated_at FROM settings WHERE key=?')
    .get(voiceKey(brandId)) as { value: string; updated_at?: string } | undefined;
  return NextResponse.json({
    content: row?.value ?? '',
    length: row?.value?.length ?? 0,
    updatedAt: row?.updated_at ?? null,
    brandId,
  });
}

export async function POST(req: NextRequest) {
  const brandId = getBrandId(req);
  if (!brandId) return NextResponse.json({ error: 'Thiếu brand — tải lại trang rồi thử lại' }, { status: 400 });
  try {
    const fd = await req.formData();
    const file = fd.get('file') as File | null;
    const text = fd.get('text') as string | null;

    let content = '';
    if (file) {
      const name = file.name.toLowerCase();
      if (name.endsWith('.docx')) {
        const { default: JSZip } = await import('jszip');
        const zip = await JSZip.loadAsync(await file.arrayBuffer());
        const xml = await zip.file('word/document.xml')?.async('string');
        // Giữ ngắt đoạn: </w:p> thành xuống dòng rồi mới bóc tag (trước đây nuốt
        // hết xuống dòng thành một khối chữ dài, preview rất khó đọc).
        if (xml) {
          content = xml
            .replace(/<\/w:p>/g, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/[ \t]+/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
        }
      } else {
        content = await file.text();
      }
    } else if (text) {
      content = text;
    }
    if (!content) return NextResponse.json({ error: 'File không có nội dung đọc được' }, { status: 400 });

    getDb().prepare(`
      INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
    `).run(voiceKey(brandId), content);

    return NextResponse.json({ ok: true, length: content.length, brandId });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const brandId = getBrandId(req);
  if (!brandId) return NextResponse.json({ error: 'Thiếu brand' }, { status: 400 });
  getDb().prepare('DELETE FROM settings WHERE key=?').run(voiceKey(brandId));
  return NextResponse.json({ ok: true });
}
