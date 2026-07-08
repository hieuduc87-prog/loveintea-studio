/**
 * Facebook / Instagram Graph API adapter
 * Credentials: reads from env first, then from settings DB (saved via FB Setup).
 */

import crypto from 'crypto';
import { getDb } from './db';
import { decrypt } from './crypto';

const GRAPH    = 'https://graph.facebook.com/v21.0';
const APP_ID   = '1267157968709745';  // Same app as HLT
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://loveintea.wealthpsy.com';

/** Make relative URL absolute so FB/IG servers can fetch it.
 *  For our own /api/images/ masters (4x, ~10MB) append ?w=4096&q=92 so the route
 *  serves a sharp full-res JPEG (~2-3MB, dưới giới hạn FB 4MB) — FB/IG reject the
 *  raw 10MB masters ("Invalid parameter"). High quality để ảnh đăng nét. */
function toAbsoluteUrl(url: string): string {
  const abs = url.startsWith('http') ? url : `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  if (abs.includes('/api/images/') && !/[?&]w=/.test(abs)) {
    return `${abs}${abs.includes('?') ? '&' : '?'}w=4096&q=95`;
  }
  return abs;
}

function getSetting(key: string): string {
  try {
    const db  = getDb();
    const row = db.prepare('SELECT value FROM settings WHERE key=?').get(key) as { value: string } | undefined;
    return row?.value ?? '';
  } catch { return ''; }
}

function token(): string {
  return process.env.FB_PAGE_ACCESS_TOKEN || getSetting('FB_PAGE_ACCESS_TOKEN') || '';
}

function pageId(): string {
  return process.env.FB_PAGE_ID || getSetting('FB_PAGE_ID') || '';
}

function igAccountId(): string {
  return process.env.IG_BUSINESS_ACCOUNT_ID || getSetting('IG_BUSINESS_ACCOUNT_ID') || '';
}

// ─────────────────────────────────────────────────────────
// Multi-brand channel credentials
// channels.credentials JSON: { page_id, page_name, ig_account_id,
//   token_enc, token_iv, token_tag } — page token AES-256-GCM encrypted
// ─────────────────────────────────────────────────────────

export interface ChannelCreds {
  pageId: string;
  pageToken: string;
  igId: string;
  pageName: string;
  source: 'channel' | 'legacy' | 'none';
}

/** Resolve FB/IG credentials for a brand: channels row first, legacy env/settings fallback. */
export function getChannelCreds(brandId?: string): ChannelCreds {
  if (brandId) {
    try {
      const row = getDb().prepare(
        `SELECT credentials FROM channels
         WHERE brand_id=? AND platform='facebook' AND status='active'
         ORDER BY created_at DESC LIMIT 1`
      ).get(brandId) as { credentials: string } | undefined;
      if (row) {
        const c = JSON.parse(row.credentials) as Record<string, string>;
        if (c.token_enc && c.page_id) {
          return {
            pageId: c.page_id,
            pageToken: decrypt(c.token_enc, c.token_iv, c.token_tag),
            igId: c.ig_account_id || '',
            pageName: c.page_name || '',
            source: 'channel',
          };
        }
      }
    } catch { /* fall through to legacy */ }
  }
  // TENANT ISOLATION: only the built-in 'loveintea' store may fall back to the
  // legacy env/settings credentials. Any other brand with no channel row returns
  // EMPTY creds (source:'none') so publishing fails loudly ("store chưa nối
  // Facebook") instead of silently posting to the Loveintea page.
  if (brandId && brandId !== 'loveintea') {
    return { pageId: '', pageToken: '', igId: '', pageName: '', source: 'none' };
  }
  return { pageId: pageId(), pageToken: token(), igId: igAccountId(), pageName: getSetting('FB_PAGE_NAME'), source: 'legacy' };
}

/** True nếu brand đã cấu hình Instagram (có page token + IG account id).
 *  Dùng để SKIP IG thay vì hard-fail khi IG chưa kết nối. */
export function hasIgCreds(brandId?: string): boolean {
  const c = getChannelCreds(brandId);
  return Boolean(c.pageToken && c.igId);
}

export interface PostResult {
  ok: boolean;
  postId?: string;
  error?: string;
}

/** Upload a photo unpublished and return media_fbid */
async function uploadPhoto(imageUrl: string, creds: ChannelCreds): Promise<string> {
  const r = await fetch(`${GRAPH}/${creds.pageId}/photos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: imageUrl, published: false, access_token: creds.pageToken }),
  });
  const d = await r.json() as { id?: string; error?: { message: string } };
  if (!d.id) throw new Error(d.error?.message ?? 'Photo upload failed');
  return d.id;
}

/** Post to FB Page feed — supports immediate or scheduled */
export async function postToFacebook(opts: {
  caption: string;
  imageUrls: string[];
  scheduledAt?: Date;
  brandId?: string;
}): Promise<PostResult> {
  try {
    const creds = getChannelCreds(opts.brandId);
    const tok = creds.pageToken;
    const pid = creds.pageId;
    if (!tok || !pid) {
      return {
        ok: false,
        error: creds.source === 'none'
          ? 'Store chưa kết nối Facebook — vào Channels để nối Page trước khi đăng.'
          : 'FB credentials not configured.',
      };
    }

    const { caption, imageUrls, scheduledAt } = opts;

    const mediaIds: string[] = [];
    for (const url of imageUrls) {
      if (url) mediaIds.push(await uploadPhoto(toAbsoluteUrl(url), creds));
    }

    const body: Record<string, unknown> = {
      message: caption,
      access_token: tok,
    };

    if (scheduledAt) {
      body.published              = false;
      body.scheduled_publish_time = Math.floor(scheduledAt.getTime() / 1000);
    }

    if (mediaIds.length > 0) {
      body.attached_media = mediaIds.map(id => ({ media_fbid: id }));
    }

    const r = await fetch(`${GRAPH}/${pid}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const d = await r.json() as { id?: string; error?: { message: string } };
    if (!d.id) return { ok: false, error: d.error?.message ?? 'Post failed' };
    return { ok: true, postId: d.id };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/** Post to Instagram Business Account */
export async function postToInstagram(opts: {
  caption: string;
  imageUrls: string[];
  brandId?: string;
}): Promise<PostResult> {
  try {
    const creds = getChannelCreds(opts.brandId);
    const tok  = creds.pageToken;
    const igId = creds.igId;
    if (!tok || !igId) return { ok: false, error: 'IG credentials not configured. Go to Publisher → FB Setup.' };

    const { caption, imageUrls } = opts;

    if (imageUrls.length <= 1) {
      const url = toAbsoluteUrl(imageUrls[0] ?? '');
      if (!url) return { ok: false, error: 'Image URL required for IG post' };

      const contRes = await fetch(`${GRAPH}/${igId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: url, caption, access_token: tok }),
      });
      const cont = await contRes.json() as { id?: string; error?: { message: string } };
      if (!cont.id) return { ok: false, error: cont.error?.message ?? 'Container failed' };

      const pubRes = await fetch(`${GRAPH}/${igId}/media_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creation_id: cont.id, access_token: tok }),
      });
      const pub = await pubRes.json() as { id?: string; error?: { message: string } };
      if (!pub.id) return { ok: false, error: pub.error?.message ?? 'Publish failed' };
      return { ok: true, postId: pub.id };
    }

    // Carousel
    const children: string[] = [];
    for (const url of imageUrls) {
      const r = await fetch(`${GRAPH}/${igId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: toAbsoluteUrl(url), is_carousel_item: true, access_token: tok }),
      });
      const d = await r.json() as { id?: string };
      if (d.id) children.push(d.id);
    }
    const carRes = await fetch(`${GRAPH}/${igId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ media_type: 'CAROUSEL', children: children.join(','), caption, access_token: tok }),
    });
    const car = await carRes.json() as { id?: string; error?: { message: string } };
    if (!car.id) return { ok: false, error: car.error?.message ?? 'Carousel failed' };

    const pubRes = await fetch(`${GRAPH}/${igId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: car.id, access_token: tok }),
    });
    const pub = await pubRes.json() as { id?: string; error?: { message: string } };
    return pub.id ? { ok: true, postId: pub.id } : { ok: false, error: pub.error?.message };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function getPagePosts(limit = 20) {
  const r = await fetch(
    `${GRAPH}/${pageId()}/feed?fields=id,message,created_time,full_picture,insights.metric(post_impressions,post_engaged_users)&limit=${limit}&access_token=${token()}`
  );
  return r.json();
}

export async function getPageInbox(limit = 50) {
  const r = await fetch(
    `${GRAPH}/${pageId()}/conversations?fields=id,snippet,updated_time,participants,unread_count&limit=${limit}&access_token=${token()}`
  );
  return r.json();
}

export async function getIgMedia(limit = 20) {
  const r = await fetch(
    `${GRAPH}/${igAccountId()}/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count&limit=${limit}&access_token=${token()}`
  );
  return r.json();
}

export async function getIgInsights() {
  const r = await fetch(
    `${GRAPH}/${igAccountId()}/insights?metric=impressions,reach,follower_count&period=day&access_token=${token()}`
  );
  return r.json();
}

// ─────────────────────────────────────────────────────────
// Token health — debug_token check for the page access token
// ─────────────────────────────────────────────────────────

export interface TokenHealth {
  configured: boolean;
  valid: boolean;
  expiresAt: string | null;   // ISO or null = never-expiring
  daysLeft: number | null;    // null = never-expiring
  pageName: string;
  error: string;
  checkedAt: string;
}

/** Validate the stored page token via /debug_token (needs FB_APP_SECRET for app token). */
export async function checkTokenHealth(brandId?: string): Promise<TokenHealth> {
  const now = new Date().toISOString();
  const creds = getChannelCreds(brandId);
  const tok = creds.pageToken;
  const base: TokenHealth = {
    configured: Boolean(tok && creds.pageId), valid: false,
    expiresAt: null, daysLeft: null, pageName: '', error: '', checkedAt: now,
  };
  if (!base.configured) { base.error = 'No page token configured'; return base; }

  try {
    const appSecret = process.env.FB_APP_SECRET;
    if (appSecret) {
      const r = await fetch(
        `${GRAPH}/debug_token?input_token=${tok}&access_token=${APP_ID}|${appSecret}`
      );
      const d = await r.json() as { data?: { is_valid?: boolean; expires_at?: number; error?: { message: string } }; error?: { message: string } };
      if (d.data) {
        base.valid = Boolean(d.data.is_valid);
        if (d.data.expires_at && d.data.expires_at > 0) {
          base.expiresAt = new Date(d.data.expires_at * 1000).toISOString();
          base.daysLeft = Math.floor((d.data.expires_at * 1000 - Date.now()) / 86_400_000);
        }
        if (!base.valid) base.error = d.data.error?.message ?? 'Token invalid';
      } else {
        base.error = d.error?.message ?? 'debug_token failed';
      }
    }
    // Cross-check the token can actually read the page
    const pr = await fetch(`${GRAPH}/${creds.pageId}?fields=id,name&access_token=${tok}`);
    const pd = await pr.json() as { id?: string; name?: string; error?: { message: string } };
    if (pd.id) { base.valid = true; base.pageName = pd.name ?? ''; base.error = ''; }
    else if (pd.error) { base.valid = false; base.error = pd.error.message; }
    return base;
  } catch (e) {
    base.error = String(e);
    return base;
  }
}

// ─────────────────────────────────────────────────────────
// Metrics fetchers — feed the Intelligence layer (post_metrics)
// ─────────────────────────────────────────────────────────

export interface FetchedMetrics {
  reach: number; impressions: number; engaged: number;
  reactions: number; comments: number; shares: number; saves: number;
}

/** Fetch engagement + insights for a published FB Page post. Best-effort: insights metrics vary by API version. */
export async function getFbPostMetrics(fbPostId: string, brandId?: string): Promise<FetchedMetrics | null> {
  try {
    const tok = getChannelCreds(brandId).pageToken;
    if (!tok) return null;
    const m: FetchedMetrics = { reach: 0, impressions: 0, engaged: 0, reactions: 0, comments: 0, shares: 0, saves: 0 };

    const r = await fetch(
      `${GRAPH}/${fbPostId}?fields=reactions.summary(true).limit(0),comments.summary(true).limit(0),shares&access_token=${tok}`
    );
    const d = await r.json() as Record<string, { summary?: { total_count?: number }; count?: number }> & { error?: { message: string } };
    if (d.error) return null;
    m.reactions = d.reactions?.summary?.total_count ?? 0;
    m.comments  = d.comments?.summary?.total_count ?? 0;
    m.shares    = d.shares?.count ?? 0;

    try {
      const ir = await fetch(`${GRAPH}/${fbPostId}/insights?metric=post_impressions,post_impressions_unique&access_token=${tok}`);
      const idata = await ir.json() as { data?: Array<{ name: string; values?: Array<{ value: number }> }> };
      for (const row of idata.data ?? []) {
        const v = Number(row.values?.[0]?.value ?? 0);
        if (row.name === 'post_impressions') m.impressions = v;
        if (row.name === 'post_impressions_unique') m.reach = v;
      }
    } catch { /* insights optional */ }

    m.engaged = m.reactions + m.comments + m.shares;
    return m;
  } catch { return null; }
}

/** Fetch engagement + insights for a published IG media. */
export async function getIgMediaMetrics(igMediaId: string, brandId?: string): Promise<FetchedMetrics | null> {
  try {
    const tok = getChannelCreds(brandId).pageToken;
    if (!tok) return null;
    const m: FetchedMetrics = { reach: 0, impressions: 0, engaged: 0, reactions: 0, comments: 0, shares: 0, saves: 0 };

    const r = await fetch(`${GRAPH}/${igMediaId}?fields=like_count,comments_count&access_token=${tok}`);
    const d = await r.json() as { like_count?: number; comments_count?: number; error?: { message: string } };
    if (d.error) return null;
    m.reactions = d.like_count ?? 0;
    m.comments  = d.comments_count ?? 0;

    try {
      const ir = await fetch(`${GRAPH}/${igMediaId}/insights?metric=reach,saved,shares,views&access_token=${tok}`);
      const idata = await ir.json() as { data?: Array<{ name: string; values?: Array<{ value: number }> }> };
      for (const row of idata.data ?? []) {
        const v = Number(row.values?.[0]?.value ?? 0);
        if (row.name === 'reach')  m.reach = v;
        if (row.name === 'saved')  m.saves = v;
        if (row.name === 'shares') m.shares = v;
        if (row.name === 'views')  m.impressions = v;
      }
    } catch { /* insights optional */ }

    m.engaged = m.reactions + m.comments + m.shares + m.saves;
    return m;
  } catch { return null; }
}

// expose app id for OAuth URL construction
export { APP_ID };

// ─────────────────────────────────────────────────────────
// OAuth helpers — used by /api/auth/facebook/* routes
// ─────────────────────────────────────────────────────────

/** HMAC-SHA256 proof to prevent token theft. Required for all server-side API calls. */
export function appSecretProof(accessToken: string): string {
  const secret = process.env.FB_APP_SECRET;
  if (!secret) throw new Error('FB_APP_SECRET env var is required');
  return crypto.createHmac('sha256', secret).update(accessToken).digest('hex');
}

/** Exchange short-lived authorization code for a short-lived user token */
export async function exchangeCodeForToken(code: string): Promise<{ access_token: string; expires_in: number }> {
  const url = `${GRAPH}/oauth/access_token?` + new URLSearchParams({
    client_id: APP_ID,
    client_secret: process.env.FB_APP_SECRET!,
    redirect_uri: process.env.FB_REDIRECT_URI!,
    code,
  });
  const res = await fetch(url);
  const body = await res.text();
  if (!res.ok) throw new Error(`exchangeCodeForToken failed: ${body}`);
  return JSON.parse(body);
}

/** Exchange short-lived user token for a 60-day long-lived user token */
export async function getLongLivedToken(shortToken: string): Promise<{ access_token: string; expires_in: number }> {
  const url = `${GRAPH}/oauth/access_token?` + new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: APP_ID,
    client_secret: process.env.FB_APP_SECRET!,
    fb_exchange_token: shortToken,
  });
  const res = await fetch(url);
  const body = await res.text();
  if (!res.ok) throw new Error(`getLongLivedToken failed: ${body}`);
  return JSON.parse(body);
}

/** Get Facebook user ID + display name for the token owner */
export async function getFbUser(userToken: string): Promise<{ id: string; name: string }> {
  const proof = appSecretProof(userToken);
  const res = await fetch(
    `${GRAPH}/me?fields=id,name&access_token=${userToken}&appsecret_proof=${proof}`
  );
  if (!res.ok) throw new Error(`getFbUser failed: ${await res.text()}`);
  return res.json();
}

/** Get all Pages the user manages + their never-expiring page access tokens */
export async function getUserPages(userToken: string): Promise<Array<{ id: string; name: string; access_token: string }>> {
  const proof = appSecretProof(userToken);
  const res = await fetch(
    `${GRAPH}/me/accounts?fields=id,name,access_token&limit=50&access_token=${userToken}&appsecret_proof=${proof}`
  );
  if (!res.ok) throw new Error(`getUserPages failed: ${await res.text()}`);
  const d = await res.json() as { data?: Array<{ id: string; name: string; access_token: string }>; error?: { message: string } };
  if (d.error) throw new Error(d.error.message);
  return d.data ?? [];
}

/** Find the Instagram Business Account ID linked to a Facebook Page (if any) */
export async function getLinkedIgAccount(fbPageId: string, pageToken: string): Promise<string> {
  try {
    const res = await fetch(
      `${GRAPH}/${fbPageId}?fields=instagram_business_account&access_token=${pageToken}`
    );
    const d = await res.json() as { instagram_business_account?: { id: string } };
    return d.instagram_business_account?.id ?? '';
  } catch { return ''; }
}

/** Revoke all permissions from FB (call before deleting connection from DB) */
export async function revokePermissions(userToken: string): Promise<void> {
  try {
    const proof = appSecretProof(userToken);
    await fetch(
      `${GRAPH}/me/permissions?access_token=${userToken}&appsecret_proof=${proof}`,
      { method: 'DELETE' }
    );
  } catch { /* best-effort */ }
}
