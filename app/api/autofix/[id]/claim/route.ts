import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), 'data', 'kanban')
const TOKEN = process.env.AUTOFIX_TOKEN || ''
const isPending = (s: string) => s === 'auto_fix' || s === 'autofix'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (TOKEN && req.headers.get('authorization') !== `Bearer ${TOKEN}`)
    return new NextResponse(null, { status: 401 })
  const { id } = await params
  const fp = path.join(DATA_DIR, id, 'card.json')
  try {
    const card = JSON.parse(await fs.readFile(fp, 'utf8'))
    if (!isPending(card.status)) return NextResponse.json({ error: 'Not pending autofix' }, { status: 409 })
    card.status = 'fixing'; card.claimedAt = new Date().toISOString(); card.updatedAt = new Date().toISOString()
    await fs.writeFile(fp, JSON.stringify(card, null, 2))
    return NextResponse.json({ ok: true })
  } catch { return NextResponse.json({ error: 'Not found' }, { status: 404 }) }
}
