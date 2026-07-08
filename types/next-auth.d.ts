import { DefaultSession, DefaultJWT } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: string;
      /** Brand ids this user may access (empty for admins — see allBrands). */
      brands: string[];
      /** True for admin/root_admin: may access every brand (super-admin). */
      allBrands: boolean;
    } & DefaultSession['user'];
  }

  interface User {
    role: string;
    is_approved: number;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id?: string;
    role?: string;
    is_approved?: number;
    /** Brand ids this user may access (refreshed each request). */
    brands?: string[];
    /** True for admin/root_admin. */
    allBrands?: boolean;
  }
}
