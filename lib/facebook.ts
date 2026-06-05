/**
 * Facebook / Instagram Graph API adapter
 * Credentials: reads from env first, then from settings DB (saved via FB Setup).
 */

import crypto from 'crypto';
import { getDb } from './db';

const GRAPH    = 'https://graph.facebook.com/v21.0';
const APP_ID   = '1267157968709745';  // Same app as HLT
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://loveintea.wealthpsy.com';

/** Make relative URL absolute so FB/IG servers can fetch it */
function toAbsoluteUrl(url: string): string {
  if (url.startsWith('http')) return url;
  return `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
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

export interface PostResult {
  ok: boolean;
  postId?: string;
  error?: string;
}

/** Upload a photo unpublished and return media_fbid */
async function uploadPhoto(imageUrl: string): Promise<string> {
  const r = await fetch(`${GRAPH}/${pageId()}/photos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: imageUrl, published: false, access_token: token() }),
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
}): Promise<PostResult> {
  try {
    const tok = token();
    const pid = pageId();
    if (!tok || !pid) return { ok: false, error: 'FB credentials not configured.' };

    const { caption, imageUrls, scheduledAt } = opts;

    const mediaIds: string[] = [];
    for (const url of imageUrls) {
      if (url) mediaIds.push(await uploadPhoto(toAbsoluteUrl(url)));
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
}): Promise<PostResult> {
  try {
    const tok  = token();
    const igId = igAccountId();
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
