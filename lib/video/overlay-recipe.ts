/**
 * Overlay HTML cho template bazan_recipe — bám đúng style final thật của Bazan:
 *  - HOOK: tên món 2 dòng giữa-trên (dòng 1 nhỏ nghiêng, dòng 2 to đậm nghiêng, trắng + bóng)
 *  - PRODUCT/BREWING: brand line 2 dòng (dòng 1 trắng, dòng 2 màu accent)
 *  - PROCESS: caption nguyên liệu 1 dòng bold trắng giữa màn
 *  - RESULT: không text
 * Không progress bar / badge / CTA card — final Bazan sạch, chỉ text.
 * DETERMINISM: window.SEEK(ms) là pure function của t.
 */

export interface RecipeOverlayProject {
  durationMs: number;
  dishLine1: string;
  dishLine2: string;
  brandLine1?: string;
  brandLine2?: string;
  accent: string; // màu dòng brand thứ 2 (vd vàng Bazan)
  // các cửa sổ thời gian tuyệt đối trên timeline
  windows: Array<{ startMs: number; endMs: number; kind: 'dish' | 'brand' | 'step' | 'none'; text?: string }>;
}

function esc(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

export function recipeOverlayHtml(p: RecipeOverlayProject): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:540px; height:960px; background:transparent; overflow:hidden;
    font-family:'Noto Sans','DejaVu Sans',sans-serif; }
  .sh { text-shadow:0 2px 10px rgba(0,0,0,.65), 0 0 2px rgba(0,0,0,.5); }
  #dish { position:absolute; top:225px; left:24px; right:24px; text-align:center; opacity:0; }
  #dish .l1 { font-size:27px; font-weight:600; font-style:italic; color:#fff; letter-spacing:.5px; }
  #dish .l2 { font-size:58px; font-weight:900; font-style:italic; color:#fff; line-height:1.05; margin-top:2px; }
  #brand { position:absolute; top:265px; left:24px; right:24px; text-align:center; opacity:0; }
  #brand .l1 { font-size:27px; font-weight:800; color:#fff; }
  #brand .l2 { font-size:27px; font-weight:800; color:${esc(p.accent)}; }
  #step { position:absolute; top:445px; left:24px; right:24px; text-align:center;
    font-size:27px; font-weight:800; color:#fff; opacity:0; }
  </style></head><body>
  <div id="dish" class="sh"><div class="l1">${esc(p.dishLine1)}</div><div class="l2">${esc(p.dishLine2)}</div></div>
  <div id="brand" class="sh"><div class="l1">${esc(p.brandLine1 ?? '')}</div><div class="l2">${esc(p.brandLine2 ?? '')}</div></div>
  <div id="step" class="sh"></div>
  <script>
  const W = ${JSON.stringify(p.windows)};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const ease=t=>1-Math.pow(1-t,3);
  // fade in 250ms / out 250ms trong cửa sổ — pure theo t
  function vis(ms,w){ const local=ms-w.startMs, len=w.endMs-w.startMs;
    return Math.min(ease(clamp(local/250,0,1)), 1-clamp((local-(len-250))/250,0,1)); }
  window.SEEK = function(ms){
    let dish=0, brand=0, step=0, stepTxt='';
    for(const w of W){
      if(ms<w.startMs||ms>=w.endMs) continue;
      if(w.kind==='dish') dish=Math.max(dish,vis(ms,w));
      else if(w.kind==='brand') brand=Math.max(brand,vis(ms,w));
      else if(w.kind==='step'&&w.text){ step=vis(ms,w); stepTxt=w.text; }
    }
    document.getElementById('dish').style.opacity=dish;
    document.getElementById('brand').style.opacity=brand;
    const st=document.getElementById('step');
    st.textContent=stepTxt; st.style.opacity=step;
  };
  </script></body></html>`;
}
