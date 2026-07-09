/**
 * Minimal HTML sanitizer for LLM-generated blog content.
 *
 * The blog HTML is produced by our own Gemini prompt, but the `topic` seed is
 * user-controlled and can steer the model into emitting <script>/onerror
 * markup — which, rendered via dangerouslySetInnerHTML, is stored XSS. This
 * strips the dangerous constructs. It is NOT a general-purpose sanitizer for
 * arbitrary attacker HTML (use DOMPurify for that); it is a focused defense for
 * this trusted-ish, structured content path. Applied at BOTH store and render.
 */
export function sanitizeBlogHtml(html: string): string {
  if (!html) return '';
  return String(html)
    // Drop whole dangerous elements + their content.
    .replace(/<\s*(script|style|iframe|object|embed|link|meta|base|form)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    // Drop self-closing / unclosed dangerous tags.
    .replace(/<\s*(script|style|iframe|object|embed|link|meta|base|form)\b[^>]*>/gi, '')
    // Strip inline event handlers: on*="..." / on*='...' / on*=value.
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
    // Neutralize javascript:/data:/vbscript: URLs in href/src.
    .replace(/(href|src)\s*=\s*("|')\s*(javascript|data|vbscript):[^"']*\2/gi, '$1=$2#$2')
    .replace(/(href|src)\s*=\s*(javascript|data|vbscript):[^\s>]+/gi, '$1=#');
}
