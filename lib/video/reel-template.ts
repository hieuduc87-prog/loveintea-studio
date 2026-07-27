/**
 * Reel template "Iced Summer Sensory v01" — đúc nguyên văn từ đề bài 5 phiếu A-E
 * của Creative Hub (Google Doc 22/07/2026, Hà Phương – DLS MKT).
 * Đây là "video grammar" của template: timeline 8 block theo giây, luật nhịp,
 * SFX map, grade, palette, safe zone. Data thay đổi mỗi video (SKU, prompt) do
 * reel-director bơm vào — template thì cố định và version hóa trong repo.
 */

export interface ReelBlock {
  id: string;
  start: number;              // giây bắt đầu trong video final
  end: number;                // giây kết thúc
  /** Concept cảnh (tiếng Anh) — Subject/Action gốc để prompt builder bám vào. */
  concept: string;
  /** 1 camera move DUY NHẤT (luật Master Formula — nhiều move = jitter). */
  camera: string;
  /** Prompt SFX ASMR cho block (ElevenLabs sound-effects). */
  sfx: string;
  /** Chuyển cảnh SANG block kế: hard cut | match cut (vẫn là cut, chọn đoạn theo
   *  hướng chuyển động) | xfade 0.3s. Phiếu C: hard 70%, match 20%, xfade 10%. */
  transitionOut: 'hard' | 'match' | 'xfade';
  kind: 'ai' | 'endcard';
  /** Lệnh FLUX Kontext EDIT từ ảnh HERO (giữ nguyên ly/mặt bàn/ánh sáng) —
   *  continuity: 4 scene có ly phải là CÙNG MỘT cái ly. undefined = dùng thẳng
   *  hero (DRINK_BEAUTY) hoặc t2i tự do (scene không dính ly). */
  edit?: string;
  /** Scene này có ly trong hình → phải qua consistency gate so với hero. */
  hasGlass?: boolean;
}

/** Ảnh HERO — nguồn continuity duy nhất của cả video: ly thành phẩm + mặt bàn +
 *  ánh sáng chuẩn. Mọi scene có ly đều Kontext-edit từ ảnh này. */
export const HERO_CONCEPT =
  'a tall clear glass filled with iced {liquidColor} herbal tea, realistic ice cubes, ' +
  'condensation drops on the glass, natural color, premium beverage beauty shot';

/** Timeline Iced Summer 10s — Phiếu C, đúng từng mốc giây. */
export const ICED_SUMMER_BLOCKS: ReelBlock[] = [
  {
    id: 'MACRO_HOOK', start: 0, end: 1.2, kind: 'ai',
    concept: 'extreme close-up macro of {ingredient} with visible texture and gentle motion, droplets of moisture, tactile and fresh',
    camera: 'slow push-in macro',
    sfx: 'gentle herb rustle and soft fingertip touch on fresh botanical, close ASMR texture sound',
    transitionOut: 'hard',
    edit: 'Transform into an extreme close-up macro of {ingredient} resting on the same warm stone surface with the same soft morning daylight; the glass is out of frame. Keep the exact same color mood, surface texture and lighting.',
  },
  {
    id: 'ICE_IMPACT', start: 1.2, end: 2.4, kind: 'ai', hasGlass: true,
    edit: 'Keep the EXACT same glass, same surface and same background. The glass is now only two-thirds full of the same {liquidColor} iced tea, with two clear ice cubes captured mid-air falling into it, a small natural splash. Do not change the glass shape, material, position or lighting.',
    concept: 'clear ice cubes dropping into a tall glass of {liquidColor} herbal iced tea, splash and bubbles rising, cold condensation on glass, natural look, not soda not cocktail',
    camera: 'locked static close shot',
    sfx: 'ice cubes clinking and dropping into a cold glass with a small liquid splash, crisp ASMR',
    transitionOut: 'hard',
  },
  {
    id: 'INGREDIENT_ACTION', start: 2.4, end: 3.6, kind: 'ai', hasGlass: true,
    edit: 'Keep the EXACT same glass, surface and lighting. Add a hand gently placing {ingredient} onto the stone surface beside the same glass, tactile and natural. Do not change the glass shape or position.',
    concept: 'hands gently placing or slicing {ingredient} on a bright warm stone surface, tactile real texture, quick natural action',
    camera: 'top-down static',
    sfx: 'soft knife slice and herb placement taps on a stone board, delicate ASMR',
    transitionOut: 'hard',
  },
  {
    id: 'BREW_POUR', start: 3.6, end: 5.0, kind: 'ai', hasGlass: true,
    edit: 'Keep the EXACT same glass on the same surface with the same lighting. Show {liquidColor} tea being poured into this glass from above over ice, liquid captured mid-pour with gentle swirl. Do not change the glass shape, material or position.',
    concept: 'freshly brewed {liquidColor} herbal tea being poured over ice in a tall clear glass, liquid swirling and color blooming through the ice',
    camera: 'slow tilt down following the pour',
    sfx: 'tea pouring over ice with liquid swirl and gentle glass resonance, satisfying ASMR pour',
    transitionOut: 'match',
  },
  {
    id: 'SUMMER_LIFT', start: 5.0, end: 6.3, kind: 'ai', hasGlass: true,
    edit: 'Keep the EXACT same glass, tea, surface and lighting. Add {garnish} captured falling into the glass with a tiny splash and slight ice movement. Do not change anything else.',
    concept: 'a light garnish of {garnish} dropping softly into the iced tea, tiny splash, ice shifting, bright summer feel',
    camera: 'locked static macro',
    sfx: 'light garnish drop with tiny splash and ice movement in glass',
    transitionOut: 'hard',
  },
  {
    // DRINK_BEAUTY không có edit — nó dùng THẲNG ảnh hero (chính là hero shot)
    id: 'DRINK_BEAUTY', start: 6.3, end: 7.8, kind: 'ai', hasGlass: true,
    concept: 'finished glass of iced {liquidColor} herbal tea, realistic ice, condensation drops sliding, natural color, premium beverage beauty shot',
    camera: 'very slow orbital arc',
    sfx: 'soft carbonation-free bubble settle, tiny ice crackle, cold condensation ambience',
    transitionOut: 'xfade',
  },
  {
    id: 'RITUAL_PAYOFF', start: 7.8, end: 8.8, kind: 'ai', hasGlass: true,
    edit: 'Keep the EXACT same glass, tea, surface and lighting. Add a hand gently reaching and holding the same glass as if about to lift it. Do not change the glass shape, fill level, material or the scene.',
    concept: 'a hand gently lifting the glass of iced herbal tea from a bright summer table, relaxed premium moment',
    camera: 'locked static medium shot',
    sfx: 'glass lifted from table with a soft slide and set-down, quiet room ambience',
    transitionOut: 'xfade',
  },
  {
    id: 'PRODUCT_CTA', start: 8.8, end: 10.0, kind: 'endcard',
    concept: 'end card: approved packshot + logo + soft CTA (composite — KHÔNG AI generate)',
    camera: 'static, zoom 1.0→1.04',
    sfx: 'single soft warm chime, gentle logo resolve',
    transitionOut: 'hard',
  },
];

/** Phiếu B — bảng SKU. accent hex theo đề bài; liquid/garnish theo brewing table. */
export interface SkuInfo {
  code: string; productSlug: string; name: string;
  accent: string;                 // SKU accent color (detail only)
  ingredient: string;             // macro/ingredient-action subject
  garnish: string;                // summer-lift subject (garnish hợp lệ, không claim sai)
  liquidColor: string;            // mô tả màu nước tự nhiên
  moment: string;                 // hoàn cảnh sử dụng (caption)
}

export const SKUS: Record<string, SkuInfo> = {
  HIB: {
    code: 'HIB', productSlug: 'hibiscus', name: 'Hibiscus', accent: '#5B8C3E',
    ingredient: 'dried hibiscus petals, deep ruby red, delicate translucent texture',
    garnish: 'a thin curl of tangerine peel',
    liquidColor: 'vivid ruby-red',
    moment: 'Afternoon refresh / iced summer / beauty ritual',
  },
  PEP: {
    code: 'PEP', productSlug: 'peppermint', name: 'Peppermint', accent: '#5BBCD2',
    ingredient: 'fresh peppermint leaves, vibrant green, cool and crisp',
    garnish: 'a small sprig of fresh mint',
    liquidColor: 'light golden-green',
    moment: 'Summer cooling / after-meal refresh',
  },
  GIN: {
    code: 'GIN', productSlug: 'ginger', name: 'Ginger', accent: '#C98A3B',
    ingredient: 'fresh ginger slices with cinnamon stick and jasmine petals',
    garnish: 'a thin fresh ginger slice',
    liquidColor: 'pale golden amber',
    moment: 'Morning warmth / daily comfort',
  },
  DAN: {
    code: 'DAN', productSlug: 'dandelion', name: 'Dandelion', accent: '#D9A82E',
    ingredient: 'dried dandelion flowers with tangerine peel pieces',
    garnish: 'a strip of dried tangerine peel',
    liquidColor: 'warm golden',
    moment: 'Morning reset / after-meal ritual',
  },
  LBM: {
    code: 'LBM', productSlug: 'lemon-balm', name: 'Lemon Balm', accent: '#A8C64E',
    ingredient: 'fresh lemon balm leaves with fennel seeds, soft green',
    garnish: 'a small lemon balm leaf',
    liquidColor: 'light bright gold',
    moment: 'Daytime calm / 3pm pause',
  },
  NN: {
    code: 'NN', productSlug: 'nighty-night', name: 'Nighty Night', accent: '#5A5F9E',
    ingredient: 'dried chamomile and calming herbs, soft muted tones',
    garnish: 'a dried chamomile flower',
    liquidColor: 'soft warm amber',
    moment: 'Evening / bedtime wind-down',
  },
};

/** Phiếu D — palette core (SKU accent chỉ dùng làm detail, không phủ video). */
export const PALETTE = {
  cream: '#FFF8F0',       // Cotton Cream — end card, text pill
  green: '#1A5632',       // Heritage Green — hook, CTA, label chính
  coral: '#E04854',       // Love Coral — chỉ rất ít ở CTA/highlight
  earth: '#2D2D2D',       // Deep Earth — text nhỏ trên nền sáng
};

/** Phiếu D — safe zone trên canvas 1080×1920 (nửa scale khi render 540×960). */
export const SAFE = { top: 250, bottom: 450, side: 90, textZoneTop: 320, textZoneBottom: 1380, maxTexts: 3 };

/** Grade LOVEINTEA_WARM_FRESH_SUMMER_AI_REF_V01 — ffmpeg filter dựng từ thông số
 *  Phiếu D: temp +3..5, contrast -5..-10, highlights -10..-15, shadows +10..+18,
 *  sat -8..-15, grain nhẹ, sharpen macro. (Số ffmpeg ≠ số Lightroom — đây là bản
 *  chuyển đổi giữ đúng Ý ĐỒ: ấm nhẹ, mềm contrast, nâng shadow, hạ sat, nét macro.) */
export const REEL_GRADE_VF =
  "eq=contrast=0.96:saturation=0.90:brightness=0.01," +
  "colorbalance=rs=0.03:rm=0.02:bs=-0.03," +                 // ấm +: đẩy đỏ shadow/midtone, rút xanh dương
  "curves=all='0/0.04 0.5/0.52 1/0.96'," +                    // shadows lift + highlights soften
  "unsharp=5:5:0.4:5:5:0.0," +                                // sharpen nhẹ cho macro
  "noise=alls=4:allf=t";                                      // grain rất nhẹ

/** Negative prompt global (Phiếu B/E) — CẤM chữ AI, neon, soda, copy đối thủ, lỗi AI. */
export const NEGATIVE_PROMPT =
  'no text, no letters, no words, no watermark, no logo, no subtitles, no captions, ' +
  'no readable packaging, no neon colors, no soda, no cocktail, no party scene, ' +
  'no syrup look, no oversaturation, no glitch, no flicker, no distorted hands, ' +
  'no extra fingers, no warped glass, no unrealistic liquid physics, no dark apothecary mood, ' +
  // Đề bài (Reference-to-LoveinTea mapping): cấm fruit không thuộc SKU lọt vào từ thói quen model
  'no raspberries, no cherries, no grapes, no strawberries, no lemon slices unless specified';

/** Khối chất lượng + style chung — append vào MỌI prompt (video-ai skill: verbatim, không paraphrase). */
export const QUALITY_BLOCK =
  'Premium summer beverage commercial, natural bright daylight, macro food photography, ' +
  '35mm shallow depth of field, warm fresh color grade, tactile realistic textures, ' +
  '4K sharp clarity, stable picture, no flickering';

/** Continuity canvas — dán VERBATIM vào mọi prompt có ly/bối cảnh để 8 scene AI rời
 *  nhau vẫn cùng 1 thế giới (cùng ly, cùng mặt bàn, cùng ánh sáng). */
export const SCENE_CANVAS =
  'the same tall clear glass on a bright warm-beige stone surface, soft morning daylight ' +
  'from the left, airy minimal summer kitchen background softly blurred';

/** Mapping scene order theo loại video (Phiếu B) — engine dùng chung, order khác.
 *  v01: iced_summer render đầy đủ; các loại khác dùng cùng block pool. */
export const VIDEO_TYPE_ORDERS: Record<string, string[]> = {
  iced_summer: ['MACRO_HOOK', 'ICE_IMPACT', 'INGREDIENT_ACTION', 'BREW_POUR', 'SUMMER_LIFT', 'DRINK_BEAUTY', 'RITUAL_PAYOFF', 'PRODUCT_CTA'],
  product: ['MACRO_HOOK', 'INGREDIENT_ACTION', 'BREW_POUR', 'DRINK_BEAUTY', 'RITUAL_PAYOFF', 'PRODUCT_CTA'],
  branding: ['MACRO_HOOK', 'ICE_IMPACT', 'BREW_POUR', 'DRINK_BEAUTY', 'RITUAL_PAYOFF', 'PRODUCT_CTA'],
  educate: ['MACRO_HOOK', 'INGREDIENT_ACTION', 'BREW_POUR', 'SUMMER_LIFT', 'DRINK_BEAUTY', 'PRODUCT_CTA'],
  sale: ['ICE_IMPACT', 'BREW_POUR', 'DRINK_BEAUTY', 'RITUAL_PAYOFF', 'PRODUCT_CTA'],
};

/** CTA mềm cho phép (Phiếu C: không "Buy now/Hurry/Limited time"). */
export const SOFT_CTAS = [
  'Find your summer blend',
  'Brew your iced ritual',
  'Your afternoon, upgraded',
  'Link in bio',
];

/** Claim blacklist (Phiếu D — cấm trong text + caption + TTS). */
export const FORBIDDEN_CLAIMS = [
  'cure', 'treat', 'heal', 'detox', 'flush toxins', 'weight loss', 'burn fat',
  'fixes bloating', 'miracle', 'medicine', 'therapy', 'anti-cancer', 'chữa', 'trị bệnh',
  'giảm cân', 'thải độc', 'đặc trị',
];

export const REEL_TEMPLATE_ID = 'iced_summer_v01';
export const REEL_TOTAL_S = 10.0;
