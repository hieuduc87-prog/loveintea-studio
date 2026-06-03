export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getPagePosts } from '@/lib/facebook';

export async function GET() {
  try {
    const data = await getPagePosts(20);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
