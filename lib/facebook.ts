/**
 * Facebook / Instagram Graph API adapter
 * Adapted from hoa-lang-thang social poster pattern.
 */

const GRAPH = 'https://graph.facebook.com/v21.0';

function token() {
  const t = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!t) throw new Error('FB_PAGE_ACCESS_TOKEN not set');
  return t;
}

function pageId() {
  const id = process.env.FB_PAGE_ID;
  if (!id) throw new Error('FB_PAGE_ID not set');
  return id;
}

function igAccountId() {
  const id = process.env.IG_BUSINESS_ACCOUNT_ID;
  if (!id) throw new Error('IG_BUSINESS_ACCOUNT_ID not set');
  return id;
}

export interface PostResult {
  ok: boolean;
  postId?: string;
  error?: string;
}

/** Upload a photo unpublished and return its media_fbid */
async function uploadPhoto(imageUrl: string): Promise<string> {
  const body: Record<string, string> = {
    url: imageUrl,
    published: 'false',
    access_token: token(),
  };
  const r = await fetch(`${GRAPH}/${pageId()}/photos`, {
    method: 'POST',
    body: new URLSearchParams(body),
  });
  const data = await r.json() as { id?: string; error?: { message: string } };
  if (!data.id) throw new Error(data.error?.message ?? 'Photo upload failed');
  return data.id;
}

/** Post to FB Page feed with photos */
export async function postToFacebook(opts: {
  caption: string;
  imageUrls: string[];
}): Promise<PostResult> {
  try {
    const { caption, imageUrls } = opts;
    const mediaIds: string[] = [];

    for (const url of imageUrls) {
      const id = await uploadPhoto(url);
      mediaIds.push(id);
    }

    const body: Record<string, string> = {
      message: caption,
      access_token: token(),
    };
    if (mediaIds.length === 1) {
      body.attached_media = JSON.stringify([{ media_fbid: mediaIds[0] }]);
    } else if (mediaIds.length > 1) {
      body.attached_media = JSON.stringify(mediaIds.map(id => ({ media_fbid: id })));
    }

    const r = await fetch(`${GRAPH}/${pageId()}/feed`, {
      method: 'POST',
      body: new URLSearchParams(body),
    });
    const data = await r.json() as { id?: string; error?: { message: string } };
    if (!data.id) return { ok: false, error: data.error?.message ?? 'Post failed' };
    return { ok: true, postId: data.id };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/** Post to Instagram Business Account (carousel or single) */
export async function postToInstagram(opts: {
  caption: string;
  imageUrls: string[];
}): Promise<PostResult> {
  try {
    const { caption, imageUrls } = opts;
    const igId = igAccountId();
    const tok = token();

    if (imageUrls.length === 1) {
      // Single image
      const containerRes = await fetch(`${GRAPH}/${igId}/media`, {
        method: 'POST',
        body: new URLSearchParams({
          image_url: imageUrls[0],
          caption,
          access_token: tok,
        }),
      });
      const container = await containerRes.json() as { id?: string; error?: { message: string } };
      if (!container.id) return { ok: false, error: container.error?.message ?? 'Container failed' };

      const publishRes = await fetch(`${GRAPH}/${igId}/media_publish`, {
        method: 'POST',
        body: new URLSearchParams({
          creation_id: container.id,
          access_token: tok,
        }),
      });
      const published = await publishRes.json() as { id?: string; error?: { message: string } };
      if (!published.id) return { ok: false, error: published.error?.message ?? 'Publish failed' };
      return { ok: true, postId: published.id };
    }

    // Carousel
    const children: string[] = [];
    for (const url of imageUrls) {
      const r = await fetch(`${GRAPH}/${igId}/media`, {
        method: 'POST',
        body: new URLSearchParams({ image_url: url, is_carousel_item: 'true', access_token: tok }),
      });
      const d = await r.json() as { id?: string };
      if (d.id) children.push(d.id);
    }

    const carouselRes = await fetch(`${GRAPH}/${igId}/media`, {
      method: 'POST',
      body: new URLSearchParams({
        media_type: 'CAROUSEL',
        children: children.join(','),
        caption,
        access_token: tok,
      }),
    });
    const carousel = await carouselRes.json() as { id?: string; error?: { message: string } };
    if (!carousel.id) return { ok: false, error: carousel.error?.message ?? 'Carousel container failed' };

    const publishRes = await fetch(`${GRAPH}/${igId}/media_publish`, {
      method: 'POST',
      body: new URLSearchParams({ creation_id: carousel.id, access_token: tok }),
    });
    const published = await publishRes.json() as { id?: string; error?: { message: string } };
    if (!published.id) return { ok: false, error: published.error?.message };
    return { ok: true, postId: published.id };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/** Fetch FB Page feed posts with metrics */
export async function getPagePosts(limit = 20) {
  const r = await fetch(
    `${GRAPH}/${pageId()}/feed?fields=id,message,created_time,full_picture,insights.metric(post_impressions,post_engaged_users,post_reactions_by_type_total)&limit=${limit}&access_token=${token()}`
  );
  return r.json();
}

/** Fetch FB Page inbox messages */
export async function getPageInbox(limit = 50) {
  const r = await fetch(
    `${GRAPH}/${pageId()}/conversations?fields=id,snippet,updated_time,participants,unread_count&limit=${limit}&access_token=${token()}`
  );
  return r.json();
}

/** Fetch FB Page posts comments */
export async function getPostComments(postId: string, limit = 50) {
  const r = await fetch(
    `${GRAPH}/${postId}/comments?fields=id,from,message,created_time&limit=${limit}&access_token=${token()}`
  );
  return r.json();
}

/** Fetch IG account media with metrics */
export async function getIgMedia(limit = 20) {
  const r = await fetch(
    `${GRAPH}/${igAccountId()}/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count,reach&limit=${limit}&access_token=${token()}`
  );
  return r.json();
}

/** Fetch IG account insights */
export async function getIgInsights() {
  const r = await fetch(
    `${GRAPH}/${igAccountId()}/insights?metric=impressions,reach,follower_count&period=day&access_token=${token()}`
  );
  return r.json();
}
