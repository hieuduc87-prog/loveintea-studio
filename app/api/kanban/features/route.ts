import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

export const dynamic = 'force-dynamic'

// Liệt kê các TAB/tính năng của app (tên đẹp) để dropdown báo lỗi chọn đúng
// tính năng nào bị lỗi — KHÔNG hiện đường dẫn file. Tự đọc thư mục app/.
const SKIP = new Set(['api', 'login', 'setup', 'fonts', 'favicon.ico'])

function prettify(slug: string): string {
  return slug
    .replace(/^\(|\)$/g, '')
    .split('-').filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

async function findAppDir(): Promise<string | null> {
  const cwd = process.cwd()
  for (const c of [path.join(cwd, 'app'), path.join(cwd, 'src', 'app'), path.join(cwd, 'web', 'app')]) {
    try { if ((await fs.stat(c)).isDirectory()) return c } catch {}
  }
  return null
}

export async function GET() {
  // Ưu tiên override thủ công: data/kanban-tabs.json (cho app dùng dynamic
  // route như [tab] — không thể tự suy ra tab từ thư mục). Định dạng:
  //   ["Tên tab", ...]  hoặc  [{"name":"...","path":"..."}]
  try {
    const raw = await fs.readFile(path.join(process.cwd(), 'data', 'kanban-tabs.json'), 'utf8')
    const arr = JSON.parse(raw)
    if (Array.isArray(arr) && arr.length) {
      const tabs = arr.map((t: any) => typeof t === 'string' ? { name: t, path: '' } : { name: t.name, path: t.path || '' })
      return NextResponse.json(tabs)
    }
  } catch {}

  const appDir = await findAppDir()
  if (!appDir) return NextResponse.json([])
  try {
    const entries = await fs.readdir(appDir, { withFileTypes: true })
    const tabs: { name: string; path: string }[] = []
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith('_') || e.name.startsWith('.') || SKIP.has(e.name)) continue
      // chỉ tính dir có page.tsx/page.js (là 1 tab/route thật)
      let isPage = false
      for (const f of ['page.tsx', 'page.ts', 'page.jsx', 'page.js']) {
        try { await fs.access(path.join(appDir, e.name, f)); isPage = true; break } catch {}
      }
      if (!isPage) continue
      tabs.push({ name: prettify(e.name), path: `app/${e.name}/page.tsx` })
    }
    tabs.sort((a, b) => a.name.localeCompare(b.name))
    return NextResponse.json(tabs)
  } catch { return NextResponse.json([]) }
}
