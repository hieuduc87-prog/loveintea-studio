/**
 * Sinh ảnh theo TEMPLATE (dùng chung cho route /api/content-templates/[id]/generate
 * và luồng auto theo plan). Template N slide (collection) → N ảnh theo thứ tự, giữ bố cục;
 * template 1 ảnh → 1 ảnh suy từ layout analysis. KHÔNG insert post — caller tự tạo post.
 */
import { v4 as uuid } from 'uuid';
import { getDb } from './db';
import { editProductImage, editWithProductLock, generateImage, saveImageToFile } from './openai-image';
import { resolveProductImagePath } from './plan-generate';
import fs from 'fs';
import { pickProductRefUrl, productHasBoxImage, refImageAngle } from './product-ref';
import { verifyProductFidelity, fidelityRetryClause } from './product-fidelity';
import { generateJSON } from './gemini';

interface SlideAnalysis { index?: number; role?: string; content?: string; text_on_image?: string; visual?: string }
interface TplAnalysis {
  slides?: SlideAnalysis[]; structure?: string; skeleton?: string; style_keywords?: string[];
  layout?: { description?: string };
  colors?: { palette?: string[]; mood?: string };
  product_placement?: { has_product?: boolean; position?: string; size?: string; style?: string };
  content_direction?: string;
}

// Slide này có hiện BAO BÌ sản phẩm không, theo VAI TRÒ (card e617a81f: carousel cần cân bằng
// nguyên liệu ↔ sản phẩm — KHÔNG nhét hộp/bao bì vào mọi slide).
// Card 7554fa71: Gemini giờ trả role GHÉP 'product|ingredient|hook' — bản cũ để
// "ingredient/hook" phủ quyết TRƯỚC nên slide sản-phẩm-chính-hiệu cũng bị cấm hộp.
// Nay xét VAI TRÒ ĐẦU TIÊN (primary) trong chuỗi ghép: 'product|…' → hộp;
// 'ingredient/product' → nguyên liệu (giữ đúng bias của e617a81f).
function slideShowsProduct(role: string): boolean {
  const primary = (role || '').toLowerCase().split(/[|/,;]+/)[0].trim();
  if (/ingredient|nguyen lieu|nguyên liệu|raw|texture|hook|benefit|how[_ -]?to|lifestyle|proof/.test(primary)) return false;
  return /product|san pham|sản phẩm|packshot|packaging|bao bi|bao bì|hero|cta/.test(primary);
}

export interface TemplateGenResult {
  images: string[];
  caption: string;
  hashtags: string;
  warnings: string[];
  isCarousel: boolean;
  templateName: string;
}

/**
 * Sinh ảnh cho 1 template + (tùy chọn) sản phẩm. Trả images[] theo thứ tự + caption.
 * Throw nếu template không tồn tại / không có ảnh / không sinh được ảnh nào.
 */
/**
 * FIX HỆ THỐNG (card hoa-lang-thang "không điều chỉnh được ratio trong template"):
 * gpt-image-2 support 3 size — 1024x1024 (1:1 square), 1024x1536 (2:3 portrait),
 * 1536x1024 (3:2 landscape). Trước hardcode 2:3 → user không đổi được.
 * Map ratio "friendly" (khách quen) → size thực gpt-image-2 nhận.
 */
export type ImageRatio = '1:1' | '4:5' | '9:16' | '16:9' | '3:2';
export function ratioToGptSize(r?: ImageRatio | string): '1024x1024' | '1024x1536' | '1536x1024' {
  switch (r) {
    case '1:1':   return '1024x1024';                     // square (feed)
    case '4:5':                                            // 4:5 = 1080x1350 → gần nhất gpt-image-2 hỗ trợ = 2:3 portrait
    case '9:16':  return '1024x1536';                      // portrait (Reel/Story)
    case '16:9':
    case '3:2':   return '1536x1024';                      // landscape
    default:      return '1024x1536';                      // mặc định portrait (2:3 = post FB tối ưu)
  }
}

export async function generateTemplateImages(opts: {
  templateId: string;
  productId?: string;
  brandId?: string;
  withCaption?: boolean;           // true = sinh caption bám structure (mặc định true)
  customPrompt?: string;           // yêu cầu thêm của người dùng (làm rõ scene/đạo cụ...)
  ratio?: ImageRatio | string;     // 1:1 / 4:5 / 9:16 / 16:9 / 3:2 (default 2:3 portrait)
  onLog?: (msg: string) => void;
  onProgress?: (pct: number) => void;
}): Promise<TemplateGenResult> {
  const { templateId, productId, customPrompt, onLog, onProgress } = opts;
  const bid = opts.brandId || '';
  const gptSize = ratioToGptSize(opts.ratio);
  const db = getDb();

  const tpl = db.prepare('SELECT name, image_url, slides_json, analysis, tags, color_palette FROM content_templates WHERE id=?')
    .get(templateId) as { name?: string; image_url?: string; slides_json?: string; analysis?: string; tags?: string; color_palette?: string } | undefined;
  if (!tpl) throw new Error('Template không tồn tại');

  let slideUrls: Array<{ url: string }> = [];
  try { slideUrls = JSON.parse(tpl.slides_json || '[]'); } catch { /* */ }
  if (!slideUrls.length && tpl.image_url) slideUrls = [{ url: tpl.image_url }];
  if (!slideUrls.length) throw new Error('Template chưa có ảnh');

  let analysis: TplAnalysis = {};
  try { analysis = JSON.parse(tpl.analysis || '{}'); } catch { /* */ }

  // Chuẩn hoá meta TỪNG slide (1 ảnh layout-analysis | N ảnh collection)
  const N = slideUrls.length;
  const slidesMeta: SlideAnalysis[] = [];
  if (analysis.slides?.length) {
    for (let i = 0; i < N; i++) slidesMeta.push(analysis.slides[i] ?? analysis.slides[analysis.slides.length - 1] ?? {});
  } else {
    // Không có phân tích từng slide → gán vai trò CÂN BẰNG (tránh nhét bao bì vào mọi slide):
    // slide đầu = hook, slide cuối = product, các slide giữa = ingredient. 1 slide: theo has_product.
    const content = analysis.content_direction || analysis.layout?.description || '';
    const visual = [analysis.layout?.description, analysis.colors?.mood, analysis.product_placement?.style].filter(Boolean).join('. ');
    for (let i = 0; i < N; i++) {
      let role: string;
      if (N === 1) role = analysis.product_placement?.has_product ? 'product' : 'hook';
      else if (i === 0) role = 'hook';
      else if (i === N - 1) role = 'product';
      else role = 'ingredient';
      slidesMeta.push({ index: i + 1, role, content, visual });
    }
  }

  const product = productId
    ? db.prepare('SELECT * FROM products WHERE id=? OR (brand_id=? AND slug=?)').get(productId, bid, productId) as Record<string, string> | undefined
    : undefined;
  // ingredients trong DB có thể là chuỗi JSON '[]' — truthy nhưng RỖNG (mũ chó
  // gossby 30/07). Chuẩn hoá về text sạch; rỗng thật thì slide detail dùng
  // chất liệu/cận cảnh thay vì "components: []".
  if (product) {
    let ing = String(product.ingredients ?? '').trim();
    if (ing.startsWith('[')) {
      try { ing = (JSON.parse(ing) as unknown[]).map(x => String(x)).filter(Boolean).join(', '); }
      catch { ing = ing.replace(/[[\]"]/g, '').trim(); }
    }
    product.ingredients = ing;
  }
  const packshotPath = resolveProductImagePath(product?.image_url);
  // Sản phẩm có ẢNH bao bì thật không — không có thì prompt CẤM bịa hộp
  // (gossby 30/07: AI tự vẽ hộp carton cho mũ chó bán không hộp).
  const productHasBox = productHasBoxImage(productId);

  // Gợi ý kích thước thật để giữ TỈ LỆ hợp lý (card: hộp trà không được to quá so với lá trà).
  // Best-effort: bắt mẫu "11.5x7x14cm" / "11,5 x 7 x 14 cm" trong knowledge_json.
  let sizeHint = '';
  try {
    const m = (product?.knowledge_json || '').match(/\d{1,3}(?:[.,]\d)?\s*[x×*]\s*\d{1,3}(?:[.,]\d)?\s*[x×*]\s*\d{1,3}(?:[.,]\d)?\s*(?:cm|mm)?/i);
    if (m) sizeHint = m[0].replace(/\s+/g, '').replace(/[*×]/g, 'x');
  } catch { /* */ }

  let styleKw = '';
  try { styleKw = (JSON.parse(tpl.tags || '[]') as string[]).join(', '); } catch { /* */ }
  const analysisKw = (analysis.style_keywords ?? []).join(', ');
  const paletteMood = [analysis.colors?.palette?.join(', '), analysis.colors?.mood].filter(Boolean).join(' / ');
  const styleBits = [styleKw, analysisKw, tpl.color_palette, paletteMood].filter(Boolean).join('. ');

  // Card 49186625: ý định BAO BÌ trong ghi chú người dùng thắng vai trò slide
  // ("ko kèm vỏ hộp" mà ảnh vẫn ra hộp vì role=product ép bao bì). So khớp
  // không dấu để bắt cả "khong kem vo hop" / "ko có hộp" / "no box".
  const normNote = (customPrompt || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const noteNoPack = /(khong|ko)[^.;,]{0,24}(vo\s*hop|hop|bao\s*bi|box|packaging)|\b(no|without)\s+(the\s+)?(box|packaging)\b|ingredients?\s*only|chi\s+(co\s+)?nguyen\s*lieu/.test(normNote);
  // Card 7554fa71: nhân viên viết "thay bằng hộp trà …" mà không được nhận diện —
  // bản cũ chỉ bắt kèm/có/hiện/show/with. Nay: (a) động từ rộng hơn + hộp;
  // (b) cụm "hộp trà/hộp sản phẩm/vỏ hộp/bao bì/box/packaging" xuất hiện ở đâu
  // cũng tính là muốn hộp (noteNoPack đã chặn thể phủ định trước rồi).
  // KHÔNG bắt chữ "hop" trần: tiếng Việt không dấu dính "phù hợp/kết hợp/tổng hợp".
  const noteWithPack = !noteNoPack && (
    /(vo\s*hop|hop\s*(tra|qua|san\s*pham|giay|thiec)|bao\s*bi|\bbox\b|packaging|packshot)/.test(normNote)
    || /(dua|thay(\s*bang)?|them|chen|kem|cam|giu|dat|co|hien|show|with|include|add|insert|replace|holding)\s+(cai\s+|chiec\s+)?hop\b/.test(normNote)
  );

  // Card 1be7fe0e (blocker) — "ảnh sai packaging": mô tả slide do AI phân tích
  // template ghi NGUYÊN VĂN thương hiệu của sản phẩm GỐC ("gói trà Keats & Co",
  // "thương hiệu Botanica Origin", "nền màu cam"). Đoạn đó bị nhét thẳng vào
  // prompt dưới dạng "scene to recreate" → hoá ra đang RA LỆNH vẽ lại bao bì của
  // hãng khác, và ghi đè cả màu nền người dùng yêu cầu.
  // Cách chữa: bóc tên riêng/tên trong nháy khỏi mô tả, và hạ mô tả template
  // xuống vai trò BỐ CỤC thuần tuý.
  const stripBrandNouns = (t?: string): string => {
    if (!t) return '';
    return t
      // 'Moonlit Mint', "Bright Star" — tên sản phẩm gốc thường nằm trong nháy
      .replace(/[''""«»']([^''""«»']{2,40})[''""«»']/g, 'sản phẩm')
      // "thương hiệu X" / "brand X" / "hãng X" — bóc cụm tên riêng viết hoa theo sau.
      // KHÔNG dùng cờ `i`: cờ đó làm [A-Z] bắt cả chữ thường nên nuốt luôn từ
      // tiếng Việt đứng sau ("Origin trên" → "ên"). Liệt kê sẵn cả hai dạng hoa/thường.
      .replace(/(?:[Tt]hương hiệu|[Nn]hãn hiệu|[Bb]rand|[Hh]ãng)\s+[A-Z][A-Za-z0-9&.'-]*(?:\s+(?:&|and\s)?\s*[A-Z][A-Za-z0-9&.'-]*){0,2}/g,
        'thương hiệu của chúng tôi')
      // tên riêng dạng "Keats & Co", "Botanica Origin" đứng độc lập
      .replace(/\b[A-Z][a-zA-Z]{2,}\s*(?:&|and)\s*[A-Z][a-zA-Z.]{1,}\b/g, 'sản phẩm')
      .replace(/\s{2,}/g, ' ')
      .trim();
  };
  // Verify-gate 30/07 (test thật ra người-cầm-túi-trà thay vì HỘP): danh từ bao bì
  // trong mô tả template ("gói cà phê", pouch/sachet) ép model đổi DẠNG bao bì
  // của mình theo template. Trung hoà chúng — FORM chỉ được lấy từ ảnh tham chiếu.
  const neutralizePackForm = (t: string): string => t
    .replace(/\b(gói|túi|hộp|chai|lọ|lon|pouch|sachet|packet|bottle|jar|can|box|bag)\b(\s*(cà\s*phê|trà|coffee|tea))?/gi, 'sản phẩm')
    .replace(/\s{2,}/g, ' ').trim();
  const FORM_LOCK = 'The reference image defines the product\'s REAL packaging form — keep that exact form and shape (if it is a rectangular box, it STAYS a rectangular box); NEVER convert it into a pouch, sachet, loose tea bag or any other packaging format.';

  // Người dùng nêu màu cụ thể (hex hoặc từ chỉ màu) → bảng màu của template phải
  // nhường, nếu không "đổi nền thành #8BBF5C" thua "nền màu cam" của template.
  const userSetsColor = /#[0-9a-f]{3,8}\b|\b(mau|màu|color|background|nền)\b/i.test(customPrompt || '');

  const images: string[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < slideUrls.length; i++) {
    const meta = slidesMeta[i] ?? {};
    const role = (meta.role || (i === 0 ? 'hook' : 'other')).toLowerCase();
    const tplSlidePath = resolveProductImagePath((slideUrls[i].url || '').split('?')[0]);
    // Slide sản phẩm / người dùng đòi hộp → ref phải là ảnh CÓ HỘP theo nội dung
    // (không tin nhãn packshot suông — card 7554fa71: 'front packshot' là túi trà).
    const wantBoxRef = slideShowsProduct((slidesMeta[i] ?? {}).role || '') || noteWithPack;
    const refPath = resolveProductImagePath((pickProductRefUrl(productId, role, { preferBox: wantBoxRef }) || '').split('?')[0]);

    // QUY TẮC THAY SẢN PHẨM theo VAI TRÒ slide (card e617a81f):
    // - Slide vai trò SẢN PHẨM (product/cta/hero/packaging) → base = ảnh REF Loveintea, ép ĐÚNG bao bì vào bố cục slide.
    // - Slide vai trò NGUYÊN LIỆU/hook/benefit/how_to/proof → base = ảnh template slide (giữ bố cục),
    //   CHỈ hiện nguyên liệu của sản phẩm, TUYỆT ĐỐI không hộp/bao bì → carousel cân bằng nguyên liệu ↔ sản phẩm.
    const showProduct = noteNoPack ? false
      : Boolean(productId) && (noteWithPack || slideShowsProduct(role));
    // Verify-gate 30/07 (gossby mũ chó ra cảnh đồ ăn): sản phẩm KHÔNG có
    // ingredients mà base = ảnh template (cảnh đồ ăn) + lệnh "giữ bố cục" thì
    // đồ ăn không thể biến mất. Hàng không-tiêu-hoá: base = ảnh THẬT của sản
    // phẩm, template chỉ còn vai trò mood/màu.
    const nonConsumable = Boolean(product) && !product!.ingredients;
    // Card 7554fa71 vòng 3: một ảnh + văn xuôi KHÔNG giữ nổi form hộp. Slide sản
    // phẩm gửi CẢ HAI: ảnh 1 = template (bố cục), ảnh 2 = packshot (danh tính+form).
    const productImg = refPath || packshotPath;
    // Vòng 4: template làm ảnh CHÍNH thì model vẫn vẽ lại thiết kế hộp. Trong
    // images.edit, ảnh ĐẦU là đối tượng được giữ danh tính mạnh nhất → đảo vai:
    // packshot = ảnh chính (thiết kế bao bì bất khả xâm phạm), template = ảnh
    // phụ chỉ để lấy bố cục/góc máy.
    const base = showProduct
      ? (productImg || tplSlidePath)
      : (nonConsumable
          ? (productImg || tplSlidePath)
          : (tplSlidePath || productImg));
    const extraImagePaths = showProduct && tplSlidePath && productImg ? [tplSlidePath] : [];
    const usingProductBase = showProduct && Boolean(productImg);
    const twoImageMode = extraImagePaths.length > 0;
    // MASK-LOCK (học từ amz-pipeline): slide sản phẩm mà bố cục KHÔNG cần người
    // cầm/mặc → sản phẩm là PIXEL GỐC khoá bằng mask, model chỉ vẽ nền. Chữ và
    // artwork không thể sai vì không hề được vẽ lại. Cảnh có người cầm vẫn đi
    // đường restage 2 ảnh + fidelity gate (tay đè lên sản phẩm không khoá được).
    const layoutText = `${meta.content ?? ''} ${meta.visual ?? ''} ${customPrompt ?? ''}`;
    const layoutWantsHands = /(cầm|nắm|tay|người mẫu|người|đội|mặc|đeo|hold|holding|hand|person|model|wear|wearing)/i.test(layoutText);
    const maskLockMode = showProduct && Boolean(productImg) && !layoutWantsHands;

    const prompt = [
      `Vertical 2:3 social media image, slide ${i + 1} of ${slideUrls.length} in a carousel (role: ${role}).`,
      // LAYOUT ONLY — mô tả template chỉ nói bố cục. Mọi thương hiệu/chữ/màu nêu
      // trong đó thuộc về sản phẩm KHÁC và phải bị bỏ qua (card 1be7fe0e).
      // Card 7554fa71: trên slide SẢN PHẨM không được nói "product must NOT appear"
      // — câu đó mâu thuẫn với lệnh "place the EXACT product" và làm mất luôn hộp.
      // Slide sản phẩm: bỏ qua thương hiệu của template nhưng THAY bằng hộp mình.
      meta.content
        ? (showProduct
            ? `Use the following ONLY as a LAYOUT reference — object arrangement, framing and camera angle: ${neutralizePackForm(stripBrandNouns(meta.content))}. Any product/brand the layout mentions belongs to a DIFFERENT company — REPLACE it with OUR product from the reference image; never copy the layout's own branding, wording or packaging design. ${productHasBox ? FORM_LOCK : ''}`
            : `Use the following ONLY as a LAYOUT reference — object arrangement, framing and camera angle: ${stripBrandNouns(meta.content)}. IGNORE every brand name, product name, printed wording and colour mentioned in it; those belong to a DIFFERENT product and must NOT appear.`)
        : '',
      meta.visual ? `Camera angle/layout/style: ${stripBrandNouns(meta.visual)}.` : '',
      showProduct
        ? (twoImageMode
            ? `TWO reference images are provided. IMAGE 1 = OUR REAL PRODUCT — its ${productHasBox ? 'packaging artwork, colours, label layout, ' : ''}appearance, materials, colours, ALL printed/embroidered text and logos are FINAL and must be reproduced 100% IDENTICAL (do NOT redesign, restyle, recolour, translate or invent anything; copy the exact look). IMAGE 2 = composition/camera-angle reference ONLY — restage OUR product from IMAGE 1 into IMAGE 2's scene and pose; IMAGE 2's own product and branding must NOT appear.${productHasBox ? '' : ' This product is sold WITHOUT any retail box or packaging — NEVER draw a box, carton, pouch or any packaging for it; show ONLY the product itself.'} Our product: ${product?.name ?? ''}.`
            : `Place the EXACT product shown in the reference image into this composition/angle. Keep its packaging shape, label, ALL printed text/wording and logos, colour AND proportions 100% identical to the reference — do NOT invent, redraw, translate, blur or omit any text on the packaging; the product's printed label must stay sharp and fully legible. The reference IS our product: ${product?.name ?? ''}.`)
        : (product
            // Gossby 30/07: câu cũ viết cứng đạo cụ ngành trà ("loose herbs, dried
            // tea, bowls") → bài MŨ CHÓ ra bát gia vị. Luật L4: prompt không được
            // giả định ngành — đạo cụ suy từ CHÍNH dữ liệu sản phẩm; hàng không
            // ăn-uống thì slide này là chi tiết chất liệu / cận cảnh đang dùng.
            ? (product.ingredients
                ? `This is a DETAIL / lifestyle slide for "${product.name}"${product.theme ? ` (${product.theme})` : ''} — keep the template slide's composition. Feature its actual components/ingredients ONLY: ${product.ingredients} — arranged naturally. NEVER add food ingredients, herbs, spices, bowls or produce beyond that list. Do NOT show the product's box, packaging, sachet, pouch, printed label or any logo in this slide.`
                : `This is a DETAIL / lifestyle slide for "${product.name}"${product.theme ? ` (${product.theme})` : ''}. The reference image shows the REAL product — show it being used/worn in real life, or a close-up of its materials and craft details. Borrow ONLY the template's mood, lighting and colour palette — NOT its objects. This product is NOT food: NEVER show food, ingredients, herbs, spices, bowls, produce or cooking scenes. Avoid close-up printed logos.`)
            : ''),
      // Bảng màu template nhường khi người dùng chỉ định màu (card 1be7fe0e).
      styleBits && !userSetsColor ? `Match the template aesthetic: ${styleBits}.` : '',
      // Lệnh của người dùng đứng SAU và được tuyên bố là ưu tiên cao nhất — trước
      // đây nó chỉ là "extra instruction" nên thua mô tả template đứng trên.
      customPrompt ? `USER INSTRUCTION — HIGHEST PRIORITY, overrides the layout reference above (including its colours and any product it mentions): ${customPrompt}.` : '',
      // Tỉ lệ THỰC TẾ: mọi vật thể/nguyên liệu tự nhiên, không phóng to bất thường.
      `Keep realistic real-world proportions and believable scale between all objects (ingredients, cups, hands, props${showProduct && productHasBox ? ', and the product box' : ''}); nothing oversized, floating, giant or shrunken.${sizeHint && showProduct ? ` Real product size ≈ ${sizeHint} — respect this physical scale.` : ''}`,
      showProduct
        ? 'Photorealistic, premium, on-brand. Do NOT add any extra overlay text, captions, headings, watermarks or new logos beyond what is already printed on the product packaging. The ONLY brand name allowed anywhere in the image is the one printed on the reference product — never invent or borrow another brand name.'
        : 'Photorealistic, premium, on-brand. NO product packaging, NO box, NO sachet, NO added text, NO letters, NO logos in the image (if any text is unavoidable, ENGLISH only — never Vietnamese).',
    ].filter(Boolean).join(' ');

    try {
      let raw: string;
      if (maskLockMode && productImg) {
        onLog?.(`slide ${i + 1}: mask-lock — sản phẩm là pixel gốc, chỉ vẽ nền`);
        // GÓC MÁY THEO SẢN PHẨM: pixel bị khoá không xoay được → cảnh phải xoay
        // theo góc ảnh gốc, nếu không hộp nhìn-từ-trên nằm giữa cảnh ngang là vênh.
        const refAngle = refImageAngle(productId, pickProductRefUrl(productId, role, { preferBox: wantBoxRef }) || '');
        const CAMERA: Record<string, string> = {
          top: 'CAMERA: top-down flat-lay — shot directly from above; the tabletop surface fills the frame; every prop lies FLAT and is also seen from above; no horizon, no background wall.',
          '45': 'CAMERA: high angle about 45° looking down at the surface; props on the table seen from the same 45° perspective.',
          front: 'CAMERA: eye-level straight on at product height; background scene behind the product; surface visible at the bottom.',
          side: 'CAMERA: eye-level straight on at product height; background scene behind the product.',
        };
        const cameraClause = CAMERA[refAngle] ?? CAMERA['45'];
        const scene = [
          cameraClause,
          meta.content ? `Scene to paint around the product: ${neutralizePackForm(stripBrandNouns(meta.content))}.` : '',
          styleBits && !userSetsColor ? `Aesthetic: ${styleBits}.` : '',
          customPrompt ? `USER INSTRUCTION — HIGHEST PRIORITY: ${customPrompt}.` : '',
        ].filter(Boolean).join(' ');
        raw = await editWithProductLock({ productImagePath: productImg, prompt: scene, size: gptSize, brandId: opts.brandId });
      } else {
        raw = base
          ? await editProductImage({ productImagePath: base, prompt, size: gptSize, brandId: opts.brandId, extraImagePaths })
          : await generateImage({ prompt, size: gptSize, brandId: opts.brandId });
      }

      // GATE TRUNG THỰC SẢN PHẨM (founder 30/07): slide có sản phẩm → máy tự so
      // chữ + bao bì với ảnh thật, lệch thì tự gen lại 1 lần, vẫn lệch thì cảnh
      // báo rõ ràng — không đợi mắt người phát hiện "BELLEA".
      if (maskLockMode) {
        onLog?.(`slide ${i + 1}: QA bỏ qua — pixel sản phẩm được khoá cứng, không thể sai chữ/bao bì`);
      } else if (usingProductBase && productImg && raw.startsWith('data:')) {
        try {
          const refBuf = fs.readFileSync(productImg);
          const genBuf = Buffer.from(raw.slice(raw.indexOf(',') + 1), 'base64');
          let v = await verifyProductFidelity(refBuf, genBuf, { refHasPackaging: productHasBox });
          if (v.checked && !v.ok) {
            onLog?.(`slide ${i + 1}: QA sản phẩm FAIL (${v.textMismatch ? `chữ "${v.generatedText}" ≠ "${v.expectedText}"` : ''}${v.inventedPackaging ? ' bịa bao bì' : ''}) — gen lại…`);
            const raw2 = base
              ? await editProductImage({ productImagePath: base, prompt: `${prompt} ${fidelityRetryClause(v)}`, size: gptSize, brandId: opts.brandId, extraImagePaths })
              : raw;
            if (raw2.startsWith('data:')) {
              const v2 = await verifyProductFidelity(refBuf, Buffer.from(raw2.slice(raw2.indexOf(',') + 1), 'base64'), { refHasPackaging: productHasBox });
              if (v2.checked && v2.ok) { raw = raw2; v = v2; onLog?.(`slide ${i + 1}: QA đạt sau gen lại ✓`); }
              else if (!v2.checked || (v2.textMismatch && !v.textMismatch) === false) { raw = raw2; v = v2; }
            }
            if (v.checked && !v.ok) {
              const w = `slide ${i + 1}: ⚠ sản phẩm chưa khớp ảnh thật (${[v.textMismatch ? `chữ phải là "${v.expectedText}"` : '', v.inventedPackaging ? 'có bao bì AI tự bịa' : ''].filter(Boolean).join(', ')}) — KIỂM TRA KỸ trước khi đăng`;
              warnings.push(w); onLog?.(w);
            }
          } else if (v.checked) {
            onLog?.(`slide ${i + 1}: QA sản phẩm ✓ (chữ + bao bì khớp ảnh thật)`);
          } else {
            onLog?.(`slide ${i + 1}: QA sản phẩm bỏ qua (${v.note})`);
          }
        } catch { /* gate không bao giờ chặn việc thật */ }
      }

      const url = raw.startsWith('data:') ? await saveImageToFile(raw, `${uuid()}.png`) : raw;
      if (url) images.push(url);
      onLog?.(`slide ${i + 1}/${slideUrls.length} ✓`);
    } catch (e) {
      const m = `slide ${i + 1}: ${String(e instanceof Error ? e.message : e).slice(0, 260)}`;
      warnings.push(m); onLog?.(`⚠ ${m}`);
    }
    onProgress?.(((i + 1) / slideUrls.length) * 90);
  }

  if (!images.length) {
    // Nếu MỌI slide fail cùng 1 lý do (vd hết hạn mức OpenAI) → hiện 1 lần cho gọn,
    // không lặp "slide 1: ... | slide 2: ..." với cùng nội dung.
    const reasons = warnings.map(w => w.replace(/^slide \d+:\s*/, ''));
    const uniq = Array.from(new Set(reasons));
    throw new Error(uniq.length === 1 ? uniq[0] : `Không sinh được ảnh nào. ${warnings.join(' | ') || 'Kiểm tra OPENAI_API_KEY / quota.'}`);
  }

  // Caption bám structure (English mặc định — brand bán US)
  let caption = ''; let hashtags = '';
  if (opts.withCaption !== false) {
    const dna = db.prepare('SELECT * FROM brand_dna WHERE brand_id=?').get(bid) as Record<string, string> | undefined;
    const slideText = slidesMeta.map((s, i) => `${i + 1}. [${s.role}] ${s.content ?? ''}`).join('\n');
    const capPrompt = `Write a ${N > 1 ? 'CAROUSEL ' : ''}caption in English (brand sells the US market) for the brand "${bid}".
TEMPLATE STRUCTURE: ${analysis.structure || analysis.content_direction || ''}
SLIDES:\n${slideText}
${product ? `PRODUCT: ${product.name} — ${product.pitch ?? ''} (${product.theme ?? ''}, ingredients: ${product.ingredients ?? ''})` : 'Brand-level'}
BRAND VOICE: ${dna?.voice_traits ?? '[]'} | Tagline: ${dna?.tagline ?? ''}
COMPLIANCE: ${dna?.compliance_json ?? '{}'}
Requirements: open with a STRONG hook${N > 1 ? ' (slide 1)' : ''}, ${N > 1 ? 'mirror the slide flow, ' : ''}one clear CTA. 5-10 English hashtags.
Return ONLY JSON: {"caption":"...","hashtags":"#a #b"}`;
    try {
      const c = await generateJSON<{ caption?: string; hashtags?: string }>(capPrompt);
      caption = c.caption ?? ''; hashtags = c.hashtags ?? '';
    } catch { /* caption optional */ }
  }

  return { images, caption, hashtags, warnings, isCarousel: N > 1, templateName: tpl.name ?? templateId };
}
