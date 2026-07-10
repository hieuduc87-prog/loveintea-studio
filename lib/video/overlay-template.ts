/**
 * Transparent overlay HTML — rendered by Puppeteer frame-by-frame.
 * DETERMINISM CONTRACT (hubvideoeditorhyper lesson): window.SEEK(ms) is a pure
 * function of time — no Math.random, no incremental state, no transitions.
 * Brand colors/typography are injected via PROJECT.
 */
export interface OverlayProject {
  durationMs: number;
  hook: string;
  ctaText: string;
  brandName: string;
  colors: { primary: string; accent: string; cream: string };
  segments: Array<{ startMs: number; endMs: number; text?: string; anim?: string }>;
  /** Karaoke voiceover word-by-word (từ + start/end ms tuyệt đối). Có → hiện dòng
   *  karaoke ở đáy safe-zone, caption segment dời lên trên để không chồng nhau. */
  voWords?: Array<{ t: string; s: number; e: number }>;
}

/** HTML-escape untrusted text. hook/ctaText/brandName come from LLM output +
 *  user-editable script_json + prompt-injectable notes; interpolating them raw
 *  into markup rendered by Puppeteer is server-side XSS (and, with file access,
 *  local-file exfiltration). Always escape before embedding in the overlay. */
function esc(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

export function overlayHtml(p: OverlayProject): string {
  const hook = esc(p.hook);
  const ctaText = esc(p.ctaText);
  const brandName = esc(p.brandName);
  const brandInitial = esc((p.brandName || 'B')[0] ?? 'B');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:540px; height:960px; background:transparent; overflow:hidden;
    font-family:'Noto Sans','DejaVu Sans',sans-serif; }
  #hook { position:absolute; top:120px; left:30px; right:30px; text-align:center;
    font-size:42px; font-weight:900; line-height:1.2; color:#fff;
    text-shadow:0 2px 16px rgba(0,0,0,.75); opacity:0; }
  #hook .accent { color:${p.colors.accent}; }
  /* bottom 300-400px is covered by IG/TikTok/Shorts UI (caption/share/buttons) — keep text above ~340px */
  #caption { position:absolute; bottom:${p.voWords?.length ? 560 : 340}px; left:30px; right:30px; text-align:center; opacity:0; }
  /* karaoke VO word-by-word — 85% xem mute vẫn "đọc" được lời thoại */
  #karaoke { position:absolute; bottom:400px; left:24px; right:24px; text-align:center;
    font-size:30px; font-weight:800; line-height:1.5; display:${p.voWords?.length ? 'block' : 'none'}; }
  #karaoke span { padding:0 3px; color:rgba(255,255,255,.92);
    text-shadow:0 2px 10px rgba(0,0,0,.9), 0 0 3px rgba(0,0,0,.9); }
  #karaoke span.on { color:${p.colors.accent}; }
  #karaoke span.fut { color:rgba(255,255,255,.45); }
  #caption span { display:inline; background:rgba(0,0,0,.55); color:#fff; font-size:26px;
    font-weight:700; line-height:1.7; padding:6px 14px; border-radius:12px;
    -webkit-box-decoration-break:clone; box-decoration-break:clone; }
  #cta { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center;
    justify-content:center; gap:18px; background:rgba(10,20,12,.62); opacity:0; }
  #cta .t { font-size:38px; font-weight:900; color:#fff; text-align:center; padding:0 40px; line-height:1.3; }
  #cta .b { background:${p.colors.accent}; color:#fff; font-size:22px; font-weight:800;
    padding:12px 28px; border-radius:999px; }
  #badge { position:absolute; top:34px; left:30px; display:flex; align-items:center; gap:8px; }
  #badge .dot { width:26px; height:26px; border-radius:8px; background:${p.colors.primary};
    color:#fff; font-size:15px; font-weight:900; display:flex; align-items:center; justify-content:center; }
  #badge .n { color:#fff; font-size:14px; font-weight:700; text-shadow:0 1px 6px rgba(0,0,0,.8); }
  #bar { position:absolute; top:0; left:0; height:5px; background:${p.colors.accent}; width:0; border-radius:0 3px 3px 0; }
  </style></head><body>
  <div id="bar"></div>
  <div id="badge"><div class="dot">${brandInitial}</div><div class="n">${brandName}</div></div>
  <div id="hook">${hook}</div>
  <div id="caption"><span></span></div>
  <div id="karaoke"></div>
  <div id="cta"><div class="t">${ctaText}</div><div class="b">${brandName}</div></div>
  <script>
  const P = ${JSON.stringify({ durationMs: p.durationMs, segments: p.segments, voWords: p.voWords ?? [] })};
  // Karaoke: nhóm 4 từ/dòng, xây span 1 lần, SEEK chỉ đổi class (pure theo t)
  const KG = 4;
  const kEl = document.getElementById('karaoke');
  const kSpans = P.voWords.map(function(w){
    const s = document.createElement('span'); s.textContent = w.t; return s;
  });
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const easeOutCubic=t=>1-Math.pow(1-t,3);
  // pure function of t
  window.SEEK = function(ms){
    // progress bar
    document.getElementById('bar').style.width=(clamp(ms/P.durationMs,0,1)*540)+'px';
    // hook: in 0-400ms, hold, out 2300-2800ms
    const h=document.getElementById('hook');
    let ho=0, hs=1;
    if(ms<2800){
      const ti=easeOutCubic(clamp(ms/400,0,1));
      const to=1-clamp((ms-2300)/500,0,1);
      ho=Math.min(ti,to); hs=0.92+0.08*ti;
    }
    h.style.opacity=ho; h.style.transform='scale('+hs+')';
    // caption: per segment (skip first hook window), in 250ms, out last 250ms
    const c=document.getElementById('caption'), cs=c.querySelector('span');
    let txt='', co=0, cy=0;
    for(const s of P.segments){
      if(ms>=s.startMs && ms<s.endMs && s.text){
        const local=ms-s.startMs, len=s.endMs-s.startMs;
        const ti=easeOutCubic(clamp(local/250,0,1));
        const to=1-clamp((local-(len-250))/250,0,1);
        txt=s.text; co=Math.min(ti,to);
        cy=(s.anim==='slide')?(1-ti)*30:0;
        if(s.anim==='pop') c.style.transform='translateY(0) scale('+(0.85+0.15*ti)+')';
        else c.style.transform='translateY('+cy+'px) scale(1)';
        break;
      }
    }
    cs.textContent=txt; c.style.opacity=co;
    // karaoke: hiện nhóm 4 từ chứa từ đang đọc; từ hiện tại tô màu accent
    if(P.voWords.length){
      let idx=-1;
      for(let i=0;i<P.voWords.length;i++){ if(ms>=P.voWords[i].s && ms<P.voWords[i].e){ idx=i; break; } if(P.voWords[i].s>ms) break; }
      const lastE=P.voWords[P.voWords.length-1].e;
      if(ms>=lastE || (idx===-1 && ms<P.voWords[0].s)){
        kEl.textContent='';
      } else {
        if(idx===-1){ for(let i=0;i<P.voWords.length;i++){ if(P.voWords[i].e<=ms) idx=i; else break; } }
        const g=Math.floor(Math.max(0,idx)/KG), a=g*KG, b=Math.min(P.voWords.length,a+KG);
        // rebuild chỉ khi nhóm đổi (so sánh con đầu tiên)
        if(kEl.firstChild!==kSpans[a]){ kEl.textContent=''; for(let i=a;i<b;i++) kEl.appendChild(kSpans[i]); }
        for(let i=a;i<b;i++) kSpans[i].className = i===idx ? 'on' : (P.voWords[i].e<=ms ? '' : 'fut');
      }
    }
    // CTA end card: last 2600ms
    const ctaStart=P.durationMs-2600;
    const cta=document.getElementById('cta');
    cta.style.opacity = ms>=ctaStart ? easeOutCubic(clamp((ms-ctaStart)/450,0,1)) : 0;
  };
  </script></body></html>`;
}
