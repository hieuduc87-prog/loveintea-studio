/**
 * BRAND-FETCH GUARD (client) — chặn CẢ LỚP lỗi "ghi nhầm brand".
 *
 * Sự cố gốc (card 3fa4e238, 28/07): admin thêm tri thức ở brand X → doc rơi vào
 * brand 'loveintea'. Root cause: client gọi POST /api/knowledge KHÔNG kèm
 * `?brand=`; middleware không có gì để validate nên không inject `x-brand-id`;
 * `getBrandId()` rơi vào nhánh dự phòng "super-admin → 'loveintea'" → ghi sai brand
 * ÂM THẦM. Quét toàn repo: 94 lời gọi mutating cùng lớp lỗi này.
 *
 * Thay vì vá 94 chỗ (và chỗ thứ 95 viết ngày mai lại quên), patch `window.fetch`
 * MỘT LẦN: mọi request tới /api/* mà chưa có brand param thì tự gắn brand đang
 * xem. Middleware vẫn validate quyền như cũ → không nới lỏng bảo mật, chỉ bịt
 * đường rơi vào default sai.
 */

let activeBrandId = '';

/** AppShell gọi mỗi khi user đổi brand. */
export function setActiveBrandForFetch(brandId: string): void {
  activeBrandId = brandId || '';
}

/** Route KHÔNG được chèn brand: auth (NextAuth nhạy cảm query), platform console
 *  (admin toàn hệ), kanban/autofix (không thuộc tenant nào), images (public). */
const SKIP = [
  '/api/auth', '/api/admin', '/api/platform', '/api/kanban', '/api/autofix',
  '/api/images', '/api/webhooks', '/api/payment', '/api/account', '/api/brands?',
];

function shouldSkip(pathAndQuery: string): boolean {
  return SKIP.some(p => pathAndQuery.startsWith(p));
}

let installed = false;

export function installBrandFetchGuard(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const orig = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    try {
      if (activeBrandId) {
        const raw = typeof input === 'string' ? input
          : input instanceof URL ? input.toString()
            : (input as Request).url;
        if (raw.startsWith('/api/') && !shouldSkip(raw)) {
          const [path, query = ''] = raw.split('?');
          const params = new URLSearchParams(query);
          if (!params.has('brand') && !params.has('brandId')) {
            params.set('brand', activeBrandId);
            const next = `${path}?${params.toString()}`;
            if (typeof input === 'string' || input instanceof URL) return orig(next, init);
            // Request object: giữ nguyên body/headers, chỉ đổi URL
            return orig(new Request(next, input as Request), init);
          }
        }
      }
    } catch { /* guard không bao giờ được làm hỏng request thật */ }
    return orig(input as RequestInfo, init);
  };
}
