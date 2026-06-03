/**
 * Facebook / Instagram Graph API adapter
 * Credentials: reads from env first, then from settings DB (saved via FB Setup).
 */

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
