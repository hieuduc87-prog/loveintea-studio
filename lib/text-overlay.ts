/**
 * Text-on-image template engine — renders crisp typography OVER a photo.
 *
 * Why HTML/CSS + Puppeteer (not "ask the AI to draw text"): gpt-image-2 garbles
 * real letters. We keep the photo AI-generated but burn the headline/CTA text as
 * a deterministic HTML overlay → sharp, on-brand, correct Vietnamese diacritics.
 *
 * TODO (reference library): mỗi layout nên có 1 LIST ẢNH MẪU / REFERENCE thật
 * (post đẹp của các brand) để (a) nhân viên chọn "muốn kiểu như này", (b) làm cơ
 * sở tinh chỉnh bố cục. Hiện mới có sample tự-render từ chính layout; cần bổ sung
 * kho ảnh reference do người dùng upload — xem TEXT_OVERLAY_REFERENCE_TODO.
 */

export const TEXT_OVERLAY_REFERENCE_TODO =
  'Cần bổ sung: kho ảnh mẫu / reference (upload) cho từng layout để nhân viên chọn phong cách mong muốn.';

export interface OverlayColors {
  primary: string;   // heritage / brand accent
  accent: string;    // secondary (coral)
  cream: string;     // light text bg
  dark: string;      // dark text
}

export const DEFAULT_COLORS: OverlayColors = {
  primary: '#1A5632', accent: '#E04854', cream: '#FFF8F0', dark: '#2D2D2D',
};

export interface OverlayFields {
  headline?: string;
  sub?: string;
  cta?: string;
  badge?: string;     // small pill: "MỚI", "-20%", "BÁN CHẠY"…
}

export type OverlayLayout =
  | 'bottom-headline' | 'top-banner' | 'center-quote' | 'benefit-list' | 'promo-badge';

export interface LayoutMeta { id: OverlayLayout; name: string; desc: string; }

export const LAYOUTS: LayoutMeta[] = [
  { id: 'bottom-headline', name: 'Headline đáy', desc: 'Tiêu đề lớn + phụ đề ở đáy, nền tối gradient. Kiểu phổ biến nhất.' },
  { id: 'top-banner',      name: 'Banner đỉnh',  desc: 'Dải màu thương hiệu ở đỉnh mang tiêu đề, ảnh lộ bên dưới.' },
  { id: 'center-quote',    name: 'Trích dẫn giữa', desc: 'Câu quote/khẩu hiệu căn giữa trên ảnh làm mờ. Hợp testimonial.' },
  { id: 'benefit-list',    name: 'Liệt kê lợi ích', desc: 'Tiêu đề + 2–3 gạch đầu dòng lợi ích trên panel mờ.' },
  { id: 'promo-badge',     name: 'Khuyến mãi',    desc: 'Badge nổi (MỚI/-20%) + tiêu đề + nút CTA. Hợp sale/ra mắt.' },
];

const esc = (s = '') => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// "a | b | c" → 3 bullet lines for benefit-list
const bullets = (s = '') => s.split(/\s*[|•\n]\s*/).map(x => x.trim()).filter(Boolean).slice(0, 4);

/**
 * Full self-contained HTML page (1080x1350 @2x from 540x675 viewport).
 * imageSrc = data: URI of the base photo (embedded so Puppeteer needs no network).
 */
/** Font brand đã nhúng data: URI (card ce0d8091) — Puppeteer không cần network. */
export interface OverlayFonts {
  headline?: { dataUri: string; format: string };  // format: truetype|opentype|woff|woff2
  sub?: { dataUri: string; format: string };
}

export function overlayImageHtml(opts: {
  imageSrc: string;
  layout: OverlayLayout;
  fields: OverlayFields;
  colors?: OverlayColors;
  brandName?: string;
  fonts?: OverlayFonts;
}): string {
  const c = opts.colors || DEFAULT_COLORS;
  const f = opts.fields;
  const brand = esc(opts.brandName || '');
  const H = esc(f.headline);
  const S = esc(f.sub);
  const CTA = esc(f.cta);
  const BADGE = esc(f.badge);

  let block = '';
  switch (opts.layout) {
    case 'top-banner':
      block = `
        <div class="banner">
          <div class="h">${H}</div>
          ${S ? `<div class="s">${S}</div>` : ''}
        </div>
        ${CTA ? `<div class="cta-pill">${CTA}</div>` : ''}`;
      break;
    case 'center-quote':
      block = `
        <div class="scrim-full"></div>
        <div class="center">
          <div class="quote-mark">“</div>
          <div class="h">${H}</div>
          ${S ? `<div class="s">— ${S}</div>` : ''}
        </div>`;
      break;
    case 'benefit-list':
      block = `
        <div class="scrim-bottom"></div>
        <div class="panel">
          <div class="h">${H}</div>
          <ul>${bullets(f.sub).map(b => `<li><span class="tick">✓</span>${esc(b)}</li>`).join('')}</ul>
          ${CTA ? `<div class="cta-pill">${CTA}</div>` : ''}
        </div>`;
      break;
    case 'promo-badge':
      block = `
        <div class="scrim-bottom"></div>
        ${BADGE ? `<div class="badge">${BADGE}</div>` : ''}
        <div class="bottom">
          <div class="h">${H}</div>
          ${S ? `<div class="s">${S}</div>` : ''}
          ${CTA ? `<div class="cta-btn">${CTA} →</div>` : ''}
        </div>`;
      break;
    case 'bottom-headline':
    default:
      block = `
        <div class="scrim-bottom"></div>
        <div class="bottom">
          <div class="h">${H}</div>
          ${S ? `<div class="s">${S}</div>` : ''}
          ${brand ? `<div class="brandtag">${brand}</div>` : ''}
        </div>`;
  }

  // Font brand upload (nếu có) đứng ĐẦU fallback chain — headline riêng, subtext riêng
  const fHead = opts.fonts?.headline;
  const fSub = opts.fonts?.sub;
  const fontFaces = [
    fHead ? `@font-face { font-family:'BrandHeadline'; src:url('${fHead.dataUri}') format('${fHead.format}'); font-display:block; }` : '',
    fSub ? `@font-face { font-family:'BrandSub'; src:url('${fSub.dataUri}') format('${fSub.format}'); font-display:block; }` : '',
  ].filter(Boolean).join('\n');
  const headFamily = `${fHead ? "'BrandHeadline'," : ''}'Be Vietnam Pro','Noto Sans',system-ui,sans-serif`;
  const subFamily = `${fSub ? "'BrandSub'," : ''}'Be Vietnam Pro','Noto Sans',system-ui,sans-serif`;

  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<style>
  ${fontFaces}
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:540px; height:675px; overflow:hidden; }
  .stage { position:relative; width:540px; height:675px;
    font-family:${subFamily}; color:#fff; }
  .h { font-family:${headFamily}; }
  .stage img.bg { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
  .scrim-bottom { position:absolute; inset:0; background:linear-gradient(180deg, transparent 42%, rgba(0,0,0,0.28) 62%, rgba(0,0,0,0.82) 100%); }
  .scrim-full { position:absolute; inset:0; background:rgba(0,0,0,0.42); }
  .bottom { position:absolute; left:34px; right:34px; bottom:34px; }
  .h { font-weight:900; letter-spacing:-0.02em; line-height:1.06; font-size:40px; text-shadow:0 2px 14px rgba(0,0,0,0.45); }
  .s { margin-top:12px; font-weight:600; font-size:18px; line-height:1.4; opacity:0.95; text-shadow:0 1px 8px rgba(0,0,0,0.5); }
  .brandtag { margin-top:16px; display:inline-block; font-weight:800; font-size:13px; letter-spacing:0.14em; text-transform:uppercase;
    color:${c.cream}; border:1.5px solid rgba(255,255,255,0.55); padding:6px 14px; border-radius:999px; }
  /* top banner */
  .banner { position:absolute; top:0; left:0; right:0; background:${c.primary}; padding:30px 34px 26px; }
  .banner .h { font-size:34px; color:${c.cream}; text-shadow:none; }
  .banner .s { color:${c.cream}; opacity:0.9; text-shadow:none; }
  .cta-pill { position:absolute; bottom:34px; left:50%; transform:translateX(-50%); background:${c.accent}; color:#fff;
    font-weight:800; font-size:17px; padding:14px 30px; border-radius:999px; box-shadow:0 10px 30px rgba(0,0,0,0.35); white-space:nowrap; }
  /* center quote */
  .center { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:0 46px; }
  .center .quote-mark { font-size:90px; line-height:0.6; color:${c.accent}; font-weight:900; margin-bottom:8px; }
  .center .h { font-size:38px; }
  .center .s { margin-top:20px; font-weight:700; color:${c.cream}; }
  /* benefit list */
  .panel { position:absolute; left:30px; right:30px; bottom:30px; background:rgba(0,0,0,0.34); backdrop-filter:blur(6px);
    border:1px solid rgba(255,255,255,0.18); border-radius:20px; padding:26px 26px 24px; }
  .panel .h { font-size:30px; }
  .panel ul { list-style:none; margin-top:16px; }
  .panel li { display:flex; align-items:flex-start; gap:11px; font-weight:600; font-size:18px; line-height:1.35; margin-bottom:10px; }
  .panel .tick { flex-shrink:0; width:24px; height:24px; border-radius:50%; background:${c.primary}; color:${c.cream};
    display:grid; place-items:center; font-size:13px; font-weight:900; }
  .panel .cta-pill { position:static; transform:none; display:inline-block; margin-top:8px; }
  /* promo */
  .badge { position:absolute; top:28px; right:28px; background:${c.accent}; color:#fff; font-weight:900; font-size:22px;
    width:96px; height:96px; border-radius:50%; display:grid; place-items:center; text-align:center; line-height:1.05;
    box-shadow:0 10px 30px rgba(0,0,0,0.4); transform:rotate(8deg); }
  .cta-btn { margin-top:16px; display:inline-block; background:${c.cream}; color:${c.dark}; font-weight:800; font-size:17px;
    padding:14px 26px; border-radius:14px; box-shadow:0 8px 24px rgba(0,0,0,0.3); }
</style></head>
<body><div class="stage">
  <img class="bg" src="${opts.imageSrc}" />
  ${block}
</div></body></html>`;
}
