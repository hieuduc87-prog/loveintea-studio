import { getDb } from './db';

/**
 * Per-brand default content language. A Vietnamese brand generates Vietnamese
 * content; US/EN brands generate English. Set on brand_dna.content_language.
 * Falls back to 'en' (the existing brands sell the US market).
 */
export function getBrandLanguage(brandId?: string): 'vi' | 'en' {
  if (!brandId) return 'en';
  try {
    const r = getDb().prepare('SELECT content_language FROM brand_dna WHERE brand_id=?')
      .get(brandId) as { content_language?: string } | undefined;
    return (r?.content_language || '').toLowerCase().startsWith('vi') ? 'vi' : 'en';
  } catch { return 'en'; }
}

/** 'vi' → 'Vietnamese', anything else → 'English'. Accepts an explicit override
 *  (a per-request language) that wins over the brand default. */
export function resolveLangName(explicit: string | undefined, brandId?: string): 'Vietnamese' | 'English' {
  const lang = explicit ?? getBrandLanguage(brandId);
  return lang.toLowerCase().startsWith('vi') ? 'Vietnamese' : 'English';
}
