export { default } from 'next-auth/middleware';

export const config = {
  matcher: [
    // Public (no auth): api/auth (NextAuth), api/webhooks (FB deauthorize),
    // api/images (FB/IG servers must fetch published images),
    // api/payment/webhook + momo-callback (bank/MoMo IPN callbacks)
    '/((?!api/auth|api/webhooks|api/images|api/payment/webhook|api/payment/momo-callback|login|_next/static|_next/image|favicon.ico|brand|public).*)',
  ],
};
