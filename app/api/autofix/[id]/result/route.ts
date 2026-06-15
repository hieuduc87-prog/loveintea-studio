import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), 'data', 'kanban')
const TOKEN = process.env.AUTOFIX_TOKEN || ''

// Normalize whatever the worker reports into the canonical board vocabulary.
function normalize(status: string): string {
  if (status === 'fixed' || status === 'done') return 'fixed'
  if (status === 'fix_failed' || status === 'failed') return 'fix_failed'
  if (status === 'needs_review') return 'needs_review'
  // legacy 'autofix'/'inprogress' or anything unknown → treat as failed so the
  // card stops cycling and a human can look (never bounce back to auto_fix).
  return 'fix_failed'
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (TOKEN && req.headers.get('authorization') !== `Bearer ${TOKEN}`)
    return new NextResponse(null, { status: 401 })
  const { id } = await params
  const fp = path.join(DATA_DIR, id, 'card.json')
  try {
    const card = JSON.parse(await fs.readFile(fp, 'utf8'))
    const body = await req.json()
    card.status = normalize(body.status)
    card.fixResult = {
      summary: body.summary || '', branch: body.branch || null,
      changedFiles: body.changedFiles || [], costUsd: body.costUsd ?? null,
      durationMs: body.durationMs ?? null, fixedAt: new Date().toISOString(),
    }
    card.claimedAt = null; card.updatedAt = new Date().toISOString()
    await fs.writeFile(fp, JSON.stringify(card, null, 2))
    return NextResponse.json({ ok: true })
  } catch { return NextResponse.json({ error: 'Not found' }, { status: 404 }) }
}
