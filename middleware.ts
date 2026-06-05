export { default } from 'next-auth/middleware';

export const config = {
  matcher: [
    '/((?!api/auth|api/webhooks|login|_next/static|_next/image|favicon.ico|brand|public).*)',
  ],
};
