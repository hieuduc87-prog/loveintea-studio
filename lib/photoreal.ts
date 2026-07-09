/**
 * Photorealistic advertising-photography direction for gpt-image-2.
 *
 * Problem: default output looks fake — plastic/poreless skin, over-smooth CGI
 * surfaces, over-saturated "AI look". This block is appended to every image
 * prompt to force real-photograph behaviour.
 *
 * Synthesised from current (2026) practitioner sources on photoreal prompting:
 * - camera/lens/optical terms > "8K/hyperrealistic" clichés
 * - explicit micro-texture (pores, grain, imperfections) + negative smoothness
 * - restrained natural colour grading, real directional light
 * Sources: aivideobootcamp.com photoreal guide, wearview skin-texture, artsmart,
 *          pxz.ai negative-prompt list.
 */

export const PHOTOREAL_BLOCK = `
PHOTOREALISM — this must look like a REAL PHOTOGRAPH, not an AI render:
- Real DSLR / mirrorless photo, shot on a 50mm lens, shallow depth of field with natural bokeh and true optical focus falloff.
- Soft directional natural light (window light / golden hour / overcast daylight), realistic soft shadows, gentle highlights, subtle rim light.
- Authentic tactile materials with high-detail micro-texture: fabric grain, wood grain, ceramic, real glass reflections, condensation, faint dust and wear — real surfaces are never perfectly clean.
- Natural colour grading: restrained, muted, earthy palette, cinematic colour balance. NOT over-saturated.
- Candid, un-staged editorial moment; believable composition (rule of thirds); very subtle film grain.
HUMAN REALISM (if any person/hand appears): real skin with visible pores, natural micro-texture, subtle fine lines, uneven skin tone and natural tonal variation, light natural shine / subsurface scattering, tiny natural imperfections; anatomically correct, natural hands and fingers.
AVOID (these cause the fake AI look): plastic / waxy / airbrushed / over-smoothed poreless skin, beauty-filter, doll face, 3D render, CGI, illustration, over-sharpened "8K hyperrealistic" look, HDR, neon / fantasy / magical lighting, over-saturated or rainbow colours.`.trim();

/** Append the photoreal direction to an image prompt (idempotent-ish). */
export function withPhotoreal(prompt: string): string {
  if (!prompt) return PHOTOREAL_BLOCK;
  if (prompt.includes('PHOTOREALISM —')) return prompt; // already enhanced
  return `${prompt.trim()}\n\n${PHOTOREAL_BLOCK}`;
}
