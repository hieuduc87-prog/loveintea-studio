import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

// MUST be dynamic — without a token, authorized() short-circuits without
// reading the request, so Next.js would statically cache this GET and always
// return the build-time result (null). force-dynamic guarantees fresh polling.
export const dynamic = 'force-dynamic'
export const revalidate = 0

const DATA_DIR = path.join(process.cwd(), 'data', 'kanban')
const STUCK_MS = 30 * 60 * 1000
const TOKEN = process.env.AUTOFIX_TOKEN || ''

// Token-optional: if AUTOFIX_TOKEN is unset, allow (kanban GET is already
// unauthenticated anyway). If set, require a matching Bearer token.
function authorized(req: NextRequest) {
  if (!TOKEN) return true
  return req.headers.get('authorization') === `Bearer ${TOKEN}`
}

// A card is "pending autofix" if dragged to the Auto Fix column. Accept both
// the canonical 'auto_fix' and the legacy 'autofix' so old boards keep working.
const isPending = (s: string) => s === 'auto_fix' || s === 'autofix'

export async function GET(req: NextRequest) {
  if (!authorized(req)) return new NextResponse(null, { status: 401 })
  try {
    const entries = await fs.readdir(DATA_DIR, { withFileTypes: true })
    const now = Date.now()

    // Reset stuck "fixing" cards back to pending
    for (const e of entries) {
      if (!e.isDirectory()) continue
      try {
        const fp = path.join(DATA_DIR, e.name, 'card.json')
        const card = JSON.parse(await fs.readFile(fp, 'utf8'))
        if (card.status === 'fixing' && card.claimedAt && now - new Date(card.claimedAt).getTime() > STUCK_MS) {
          card.status = 'auto_fix'; card.claimedAt = null; card.updatedAt = new Date().toISOString()
          await fs.writeFile(fp, JSON.stringify(card, null, 2))
        }
      } catch {}
    }

    // Oldest pending card. Project context is implicit (this endpoint belongs
    // to one project) — do NOT require card.projectKey.
    const candidates = []
    for (const e of entries) {
      if (!e.isDirectory()) continue
      try {
        const card = JSON.parse(await fs.readFile(path.join(DATA_DIR, e.name, 'card.json'), 'utf8'))
        if (isPending(card.status)) candidates.push(card)
      } catch {}
    }
    // NOTE: return 200 + JSON null (NOT status 204) — Next 14's bundled undici
    // throws "Invalid response status code 204" for a null-body 204 here.
    // The worker treats JSON `null` the same as 204 (no pending card).
    if (candidates.length === 0) return NextResponse.json(null)
    candidates.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
    // Trả NGUYÊN card để worker nhận đủ field 5 lớp (feature, reproSteps,
    // wrongResult, expected, businessReason, severity, impact...).
    return NextResponse.json(candidates[0])
  } catch { return NextResponse.json(null) }
}
