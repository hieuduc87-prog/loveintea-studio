# Security tests

## Cross-tenant isolation (`cross-tenant-test.mjs`)

Proves store **A cannot reach store B's resources** — the safety net against tenant-isolation regressions when new `[id]` routes are added.

It seeds two throwaway stores (`sectest-a` / `sectest-b`) + resources owned by B directly in SQLite, logs in as a **non-admin editor of store A** via a real NextAuth credentials session, then hits every tenant/`[id]` endpoint with B's ids and asserts **403/404**. Positive controls confirm A *can* reach its own resources (so the guard isn't a blanket deny). All `sectest-` rows are removed on exit — it never touches real data.

### Run

Must run against a **local http server** (a prod `https` `NEXTAUTH_URL` makes the session cookie `Secure`, which won't set over http):

```bash
npm run build
NEXTAUTH_URL=http://localhost:3202 npx next start -p 3202 &   # or node .next/standalone/server.js
npm run test:security                                         # BASE_URL defaults to http://localhost:3202
```

Env: `BASE_URL` (default `http://localhost:3202`), `DATA_DIR` (default `./data` — must match the server's DB).

Exit code `0` = isolation holds; `1` = a cross-tenant call leaked (fix the route's `assertResourceBrand` / `canAccessBrand` guard); `2` = harness/login error.

### When to extend

Add a row to the `CROSS` array for every new tenant-scoped `[id]` route. If it 403/404s as A-vs-B, isolation holds.
