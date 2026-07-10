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

const WESTERN_LOOK = 'a natural, relatable everyday North American / Western woman (Caucasian), authentic girl-next-door look, natural un-retouched eyebrows and features — NOT a glamour model';
const VIETNAMESE_LOOK = 'a natural, relatable everyday Vietnamese woman, authentic girl-next-door look, natural un-retouched eyebrows and features — NOT a glamour model';

/**
 * Per-brand model look for AI people images. 'auto' derives from content language
 * (US/EN brand → Western model; VN brand → Vietnamese model). Returns a prompt
 * phrase to lock the on-camera person, or '' if brand unknown.
 */
export function getModelLook(brandId?: string): string {
  if (!brandId) return '';
  let look = 'auto';
  try {
    const r = getDb().prepare('SELECT model_look FROM brand_dna WHERE brand_id=?')
      .get(brandId) as { model_look?: string } | undefined;
    look = (r?.model_look || 'auto').toLowerCase();
  } catch { /* default */ }
  if (look === 'western') return WESTERN_LOOK;
  if (look === 'vietnamese') return VIETNAMESE_LOOK;
  // auto → follow language
  return getBrandLanguage(brandId) === 'vi' ? VIETNAMESE_LOOK : WESTERN_LOOK;
}
