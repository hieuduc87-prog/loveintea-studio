/**
 * Phân tích 1 inspiration item: video → ReferenceAnalysis (Gemini video) → VideoRecipe
 * + tóm tắt bài học tiếng Việt (hook pattern, cấu trúc, caption skeleton) để team học
 * và director tái dùng làm khuôn video mới.
 */
import path from 'path';
import { getDb } from '../db';
import { generateJSON } from '../gemini';
import { analyzeReferenceVideo, analysisToRecipe, ReferenceAnalysis } from '../video/analyze-reference';
import { IMAGES_DIR } from '../video/ffmpeg';
import { downloadSourceVideo } from './download';

export interface InspirationLearnings {
  learnings: string;          // tóm tắt bài học (vi)
  hook_pattern?: string;      // công thức hook nhận diện được
  caption_template?: string;  // khung caption tái dùng (placeholder {product}, {benefit}...)
}

async function summarizeLearnings(analysis: ReferenceAnalysis | null, caption: string | null): Promise<InspirationLearnings> {
  const prompt = `Bạn là chuyên gia short-form video marketing. Dưới đây là phân tích cấu trúc một video/post viral của đối thủ${caption ? ' kèm caption gốc' : ''}. Hãy rút ra bài học TÁI DÙNG ĐƯỢC cho brand F&B của chúng tôi (không sao chép nguyên văn của đối thủ).

${analysis ? `PHÂN TÍCH VIDEO (JSON):\n${JSON.stringify(analysis).slice(0, 8000)}` : ''}
${caption ? `CAPTION GỐC:\n${caption.slice(0, 2000)}` : ''}

Trả về ONLY JSON:
{"learnings":"5-8 gạch đầu dòng tiếng Việt: vì sao video/caption này hiệu quả (hook, pacing, cấu trúc cảm xúc, CTA, kỹ thuật quay/edit đáng học)",
 "hook_pattern":"công thức hook nhận diện được, 1 câu",
 "caption_template":"khung caption tái dùng với placeholder {sản phẩm}/{lợi ích}/{CTA} — chỉ khi có caption gốc, không thì bỏ trống"}`;
  try {
    return await generateJSON<InspirationLearnings>(prompt);
  } catch {
    return { learnings: '' };
  }
}

/** Chạy full phân tích cho item (tải nếu mới có URL). Cập nhật row trực tiếp. */
export async function analyzeInspirationItem(itemId: string, brandId: string): Promise<void> {
  const db = getDb();
  const item = db.prepare('SELECT * FROM inspiration_items WHERE id=? AND brand_id=?').get(itemId, brandId) as
    { id: string; url: string | null; filename: string | null; caption: string | null; media_type: string } | undefined;
  if (!item) throw new Error('Không tìm thấy item');

  const fail = (msg: string) => {
    db.prepare(`UPDATE inspiration_items SET status='failed', error=?, updated_at=datetime('now') WHERE id=?`)
      .run(msg.slice(0, 400), itemId);
  };

  try {
    let filename = item.filename;
    // Video chưa có file → tải từ URL nguồn
    if (item.media_type === 'video' && !filename) {
      if (!item.url) throw new Error('Item chưa có URL lẫn file video.');
      db.prepare(`UPDATE inspiration_items SET status='downloading', updated_at=datetime('now') WHERE id=?`).run(itemId);
      filename = await downloadSourceVideo(item.url, itemId);
      db.prepare(`UPDATE inspiration_items SET filename=?, updated_at=datetime('now') WHERE id=?`).run(filename, itemId);
    }

    db.prepare(`UPDATE inspiration_items SET status='analyzing', updated_at=datetime('now') WHERE id=?`).run(itemId);

    let analysis: ReferenceAnalysis | null = null;
    if (item.media_type === 'video' && filename) {
      const full = path.join(IMAGES_DIR, filename);
      const mime = filename.endsWith('.mov') ? 'video/quicktime' : filename.endsWith('.webm') ? 'video/webm' : 'video/mp4';
      analysis = await analyzeReferenceVideo(full, mime, itemId);
      if (!analysis) throw new Error('Gemini không phân tích được video — thử lại sau.');
    }

    const recipe = analysis ? analysisToRecipe(analysis) : {};
    const learn = await summarizeLearnings(analysis, item.caption);

    db.prepare(`UPDATE inspiration_items SET status='analyzed', analysis_json=?, recipe_json=?, learnings=?, error=NULL, updated_at=datetime('now') WHERE id=?`)
      .run(JSON.stringify({ ...analysis, hook_pattern: learn.hook_pattern, caption_template: learn.caption_template }),
        JSON.stringify(recipe), learn.learnings || '', itemId);
  } catch (e) {
    fail(String(e instanceof Error ? e.message : e));
    throw e;
  }
}
