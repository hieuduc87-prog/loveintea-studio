import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const IMAGES_DIR = path.join(process.cwd(), 'data', 'flow-images');

export async function POST(req: Request, { params }: { params: { id: string } }) {
  await fs.mkdir(IMAGES_DIR, { recursive: true });

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file' }, { status: 400 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const timestamp = Date.now();
    const filename = `${params.id}-${timestamp}.${ext}`;
    const filePath = path.join(IMAGES_DIR, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, buffer);

    return NextResponse.json({
      filename,
      url: `/api/flow-builder/${params.id}/image/${filename}`,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
