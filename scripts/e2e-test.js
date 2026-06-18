/* E2E test thật: mint session admin → gọi mọi endpoint chính (GET + POST tạo) trên production. */
const { encode } = require('next-auth/jwt');

const BASE = 'https://loveintea.wealthpsy.com';
const SECRET = process.env.NEXTAUTH_SECRET;
if (!SECRET) { console.error('NEXTAUTH_SECRET missing'); process.exit(1); }

let COOKIE = '';
const results = [];
function rec(name, ok, detail) { results.push({ name, ok, detail }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); }

async function req(method, path, body) {
  const r = await fetch(BASE + path, {
    method,
    headers: { Cookie: COOKIE, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null; const txt = await r.text();
  try { data = JSON.parse(txt); } catch { data = txt.slice(0, 200); }
  return { status: r.status, data };
}

async function get(name, path, check) {
  try {
    const { status, data } = await req('GET', path);
    if (status !== 200) return rec(name, false, `HTTP ${status} ${JSON.stringify(data).slice(0, 120)}`);
    if (check) { const msg = check(data); if (msg) return rec(name, false, msg); }
    rec(name, true, `200`);
    return data;
  } catch (e) { rec(name, false, String(e).slice(0, 120)); }
}
async function post(name, path, body, check) {
  try {
    const { status, data } = await req('POST', path, body);
    if (status !== 200 || data?.error) return rec(name, false, `HTTP ${status} ${data?.error || JSON.stringify(data).slice(0, 150)}`);
    if (check) { const msg = check(data); if (msg) return rec(name, false, msg); }
    rec(name, true, `200`);
    return data;
  } catch (e) { rec(name, false, String(e).slice(0, 120)); }
}

(async () => {
  const token = await encode({ secret: SECRET, token: {
    id: 'admin-duc', sub: 'admin-duc', role: 'root_admin', is_approved: 1,
    name: 'Duc', email: 'hieuduc87@gmail.com', picture: '',
  } });
  COOKIE = `__Secure-next-auth.session-token=${token}`;

  // ── READ endpoints ──
  await get('health', '/api/health');
  await get('jobs', '/api/jobs', d => Array.isArray(d.jobs) ? null : 'no jobs[]');
  const prods = await get('products', '/api/products?brand=loveintea', d => Array.isArray(d.products) && d.products.length ? null : 'no products');
  await get('video/projects', '/api/video/projects?brandId=loveintea');
  const tpls = await get('content-templates', '/api/content-templates?brand=loveintea&limit=100', d => Array.isArray(d.templates) ? null : 'no templates[]');
  await get('posts', '/api/posts?brand=loveintea');
  await get('plans', '/api/plans?brand=loveintea');
  await get('scoreboard', '/api/scoreboard?brand=loveintea');
  await get('brands', '/api/brands');
  const prodId = prods?.products?.[0]?.id;
  const prodName = prods?.products?.[0]?.name;
  if (prodId) {
    await get('product images', `/api/products/${prodId}/images`, d => Array.isArray(d.images) ? null : 'no images[]');
    await get('product videos', `/api/products/${prodId}/videos`);
  }

  // ── CREATE endpoints (thật, tốn AI) ──
  // 1. content/quick
  await post('content/quick (tạo content)', '/api/content/quick',
    { brandId: 'loveintea', productId: prodId, message: 'Test E2E — lợi ích trà', n: 1, language: 'en' },
    d => d.variants?.length ? null : 'no variants');

  // 2. image/generate (single)
  const img = await post('image/generate (tạo ảnh)', '/api/image/generate',
    { brandId: 'loveintea', productId: prodId, prompt: 'A premium cup of herbal tea, warm morning light, cinematic' },
    d => d.url ? null : 'no url');

  // 3. classify product images
  if (prodId) await post('classify ảnh sản phẩm', `/api/products/${prodId}/images/classify`, { all: false },
    d => typeof d.classified === 'number' ? null : 'no classified');

  // 4. template carousel (kind=collection ưu tiên) — test INSERT content_type+sku_id
  const collection = (tpls?.templates || []).find(t => t.kind === 'collection') || (tpls?.templates || [])[0];
  let tplPostId = null;
  if (collection) {
    const tg = await post(`template generate (${collection.kind})`, `/api/content-templates/${collection.id}/generate`,
      { productId: prodId, brandId: 'loveintea' },
      d => d.postId && d.images?.length ? null : 'no postId/images');
    tplPostId = tg?.postId;
  }

  const cleanup = { posts: [], projects: [] };
  if (tplPostId) cleanup.posts.push(tplPostId);
  if (img?.url) { /* image_url chỉ là file, không cần xóa */ }

  // 5. plan generate (auto-plan: tạo bài từ 1 plan item, có ảnh + template)
  const plans = await req('GET', '/api/plans?brand=loveintea');
  const planId = plans.data?.plans?.[0]?.id;
  if (planId) {
    const detail = await req('GET', `/api/plans/${planId}`);
    const itemId = detail.data?.items?.find(i => i.id)?.id;
    if (itemId) {
      const pg = await post('plan generate (auto bài + ảnh + template)', `/api/plans/${planId}/generate`,
        { itemIds: [itemId], withImage: true, useTemplate: true },
        d => (d.created?.length || d.skipped?.length) ? null : (d.errors?.length ? d.errors[0].error : 'no created/skipped'));
      (pg?.created || []).forEach(c => cleanup.posts.push(c.postId));
    } else rec('plan generate', true, 'skip — plan không có item');
  } else rec('plan generate', true, 'skip — chưa có plan');

  // 6. video project create (storyboard, KHÔNG render)
  const vp = await post('video project create (storyboard)', '/api/video/projects',
    { brandId: 'loveintea', productId: prodId, purpose: 'promo', targetDurationS: 15, useVoiceover: false, language: 'en' },
    d => d.id && d.storyboard?.segments?.length ? null : 'no storyboard');
  if (vp?.id) cleanup.projects.push(vp.id);

  // ── Cleanup test artifacts ──
  for (const id of cleanup.posts) { try { await req('DELETE', `/api/posts/${id}`); } catch {} }
  for (const id of cleanup.projects) { try { await req('DELETE', `/api/video/projects/${id}`); } catch {} }
  if (cleanup.posts.length || cleanup.projects.length) console.log(`🧹 dọn ${cleanup.posts.length} post + ${cleanup.projects.length} video test`);

  // ── Summary ──
  const fail = results.filter(r => !r.ok);
  console.log(`\n=== ${results.length - fail.length}/${results.length} PASS ===`);
  if (fail.length) { console.log('FAILED:'); fail.forEach(f => console.log(`  ✗ ${f.name}: ${f.detail}`)); process.exit(2); }
  console.log('ALL GREEN');
})();
