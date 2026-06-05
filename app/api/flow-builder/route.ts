import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuid } from 'uuid';

const DATA_DIR = path.join(process.cwd(), 'data', 'flows');

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function makeDemoFlow(): object {
  const id = uuid();
  const now = new Date().toISOString();
  const n = (suffix: string) => uuid();

  const n1 = uuid(), n2 = uuid(), n3 = uuid(), n4 = uuid(), n5 = uuid();
  const n6 = uuid(), n7 = uuid(), n8 = uuid(), n9 = uuid(), n10 = uuid();

  return {
    id,
    name: 'Image Generation — Product Photos',
    description: 'Quy trình tạo ảnh sản phẩm bằng AI: từ brief → chọn SKU + USP → build prompt → generate → review → lưu library.',
    category: 'image',
    nodes: [
      {
        id: n1, type: 'start', x: 40, y: 280,
        title: 'Start', description: '', processType: '', tool: '',
        prompt: '', promptNotes: '', inputRequired: '', outputDescription: '',
        assignedTo: '', estimatedTime: '', notes: '', outputImages: [],
      },
      {
        id: n2, type: 'step', x: 250, y: 280,
        title: 'Nhận Brief', description: 'Team content gửi brief: SKU nào, cảnh gì, mood gì, dùng cho kênh nào (FB/IG/web)',
        processType: 'manual', tool: '',
        prompt: '', promptNotes: '',
        inputRequired: 'Campaign brief, target channel, audience',
        outputDescription: 'Brief document đầy đủ thông tin',
        assignedTo: 'Content Manager', estimatedTime: '5 phút',
        notes: '', outputImages: [],
      },
      {
        id: n3, type: 'step', x: 500, y: 160,
        title: 'Chọn SKU', description: 'Chọn sản phẩm: Dandelion, Chrysanthemum, Lotus, Ginger Turmeric...',
        processType: 'manual', tool: 'LoveinTea Studio',
        prompt: '', promptNotes: '',
        inputRequired: '', outputDescription: '',
        assignedTo: 'Content Creator', estimatedTime: '2 phút',
        notes: 'Xem danh sách SKU trong Products tab', outputImages: [],
      },
      {
        id: n4, type: 'step', x: 500, y: 400,
        title: 'Chọn USP + Scene', description: 'Chọn góc độ marketing (Ritual Calm, Gentle Detox...) và bối cảnh (Morning Kitchen, Garden Moment...)',
        processType: 'manual', tool: 'LoveinTea Studio',
        prompt: '', promptNotes: '',
        inputRequired: '', outputDescription: '',
        assignedTo: 'Content Creator', estimatedTime: '3 phút',
        notes: '', outputImages: [],
      },
      {
        id: n5, type: 'ai_step', x: 760, y: 280,
        title: 'Build Prompt', description: 'System tự build prompt từ SKU + USP + Scene, kết hợp Brand DNA của LoveinTea',
        processType: 'ai', tool: 'LoveinTea Studio',
        prompt: `You are a brand photographer for LoveinTea — Timeless Remedies.
Product: {sku.name} ({sku.productName})
USP Angle: {usp.headline} — {usp.sub}
Scene: {context.label}
Brand colors: Heritage Green #1A5632, Love Coral #E04854
Voice: Warmly Wise, Cheerfully Simple, Proudly Vietnamese

Create a photorealistic lifestyle scene. Keep product prominently placed. Vietnamese aesthetic. Soft natural lighting. No text overlay.`,
        promptNotes: `Prompt được auto-generate từ brand-dna.ts.
Điều chỉnh được:
• Góc máy: add 'overhead shot', 'eye-level', 'close-up'
• Ánh sáng: 'golden hour', 'studio lighting', 'morning light'
• Mood: 'cozy', 'minimalist', 'vibrant'
• Background: 'wooden table', 'marble surface', 'garden'`,
        inputRequired: '', outputDescription: '',
        assignedTo: '', estimatedTime: '< 1 giây',
        notes: '', outputImages: [],
      },
      {
        id: n6, type: 'ai_step', x: 1020, y: 280,
        title: 'Generate với GPT-image-2', description: 'Gọi OpenAI GPT-image-2. Edit mode: dùng product photo làm reference, giữ nguyên bao bì. Generate mode: tạo mới hoàn toàn.',
        processType: 'ai', tool: 'GPT-image-2',
        prompt: `EDIT MODE (recommended):
Product image as reference — keep packaging intact and clearly visible.
Add lifestyle scene: {scene_description}
Style: photorealistic, Vietnamese aesthetic, soft natural light
Negative: blurry, distorted, text overlay, watermark

GENERATE MODE:
Full scene generation based on prompt above.
Size: 1024x1024, quality: standard`,
        promptNotes: `• Edit mode cho kết quả tốt hơn — product được giữ nguyên
• Generate mode linh hoạt hơn nhưng product có thể bị biến dạng
• Nếu output mờ → thêm 'sharp focus, high detail'
• Nếu sai màu → specify hex color trong prompt
• Rate limit: 5 requests/phút`,
        inputRequired: '', outputDescription: '',
        assignedTo: 'System (OpenAI API)', estimatedTime: '30-60 giây',
        notes: '', outputImages: [],
      },
      {
        id: n7, type: 'decision', x: 1280, y: 280,
        title: 'Review Output', description: 'Kiểm tra output: brand consistent? Product visible? Lighting OK? Vietnamese feel? No text?',
        processType: 'manual', tool: '',
        prompt: '', promptNotes: '',
        inputRequired: 'Generated image',
        outputDescription: 'Approved hoặc cần chỉnh',
        assignedTo: 'Content Creator', estimatedTime: '2 phút',
        notes: `Checklist:
✅ Product rõ và đúng bao bì
✅ Màu brand đúng (Heritage Green, Coral)
✅ Không có chữ
✅ Cảm giác Vietnamese
✅ Ánh sáng đẹp, không bị flash cứng`,
        outputImages: [],
      },
      {
        id: n8, type: 'output', x: 1520, y: 160,
        title: 'Lưu vào Image Library', description: 'Lưu ảnh vào library với metadata: SKU, USP, scene, kênh sử dụng. Ready để dùng.',
        processType: 'manual', tool: 'LoveinTea Studio',
        prompt: '', promptNotes: '',
        inputRequired: 'Approved image',
        outputDescription: 'Image stored in /api/images với full metadata JSON',
        assignedTo: 'Content Creator', estimatedTime: '1 phút',
        notes: '', outputImages: [],
      },
      {
        id: n9, type: 'step', x: 1280, y: 460,
        title: 'Chỉnh Prompt', description: 'Edit custom prompt: thêm negative prompts, chỉnh góc độ, ánh sáng, màu sắc, mood. Thay scene hoặc USP nếu cần.',
        processType: 'manual', tool: 'LoveinTea Studio',
        prompt: '', promptNotes: '',
        inputRequired: 'Output image không đạt + feedback cụ thể',
        outputDescription: 'Revised prompt hoặc settings',
        assignedTo: 'Content Creator', estimatedTime: '3-5 phút',
        notes: `Tips:
• Thêm: 'soft morning light', 'shallow depth of field'
• Thay scene nếu context sai hoàn toàn
• Đổi sang Generate mode nếu Edit mode không ăn
• Try USP khác nếu mood không phù hợp`,
        outputImages: [],
      },
      {
        id: n10, type: 'end', x: 1520, y: 280,
        title: 'Done', description: 'Ảnh đã hoàn thành và sẵn sàng sử dụng',
        processType: '', tool: '',
        prompt: '', promptNotes: '', inputRequired: '', outputDescription: '',
        assignedTo: '', estimatedTime: '', notes: '', outputImages: [],
      },
    ],
    edges: [
      { id: uuid(), from: n1, to: n2, label: 'Bắt đầu', condition: 'always' },
      { id: uuid(), from: n2, to: n3, label: 'Brief đầy đủ', condition: 'always' },
      { id: uuid(), from: n2, to: n4, label: 'Brief đầy đủ', condition: 'always' },
      { id: uuid(), from: n3, to: n5, label: 'SKU confirmed', condition: 'always' },
      { id: uuid(), from: n4, to: n5, label: 'USP + Scene ready', condition: 'always' },
      { id: uuid(), from: n5, to: n6, label: 'Prompt ready', condition: 'always' },
      { id: uuid(), from: n6, to: n7, label: 'Image generated', condition: 'always' },
      { id: uuid(), from: n7, to: n8, label: 'Ảnh đạt yêu cầu', condition: 'approved' },
      { id: uuid(), from: n7, to: n9, label: 'Cần chỉnh sửa', condition: 'rejected' },
      { id: uuid(), from: n9, to: n6, label: 'Retry với prompt mới', condition: 'always' },
      { id: uuid(), from: n8, to: n10, label: '', condition: 'always' },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

export async function GET() {
  await ensureDir();
  try {
    const entries = await fs.readdir(DATA_DIR);
    const jsonFiles = entries.filter(e => e.endsWith('.json'));

    if (jsonFiles.length === 0) {
      // Seed demo flow
      const demo = makeDemoFlow() as any;
      await fs.writeFile(
        path.join(DATA_DIR, `${demo.id}.json`),
        JSON.stringify(demo, null, 2)
      );
      return NextResponse.json([{
        id: demo.id,
        name: demo.name,
        description: demo.description,
        category: demo.category,
        updatedAt: demo.updatedAt,
      }]);
    }

    const workflows = [];
    for (const file of jsonFiles) {
      try {
        const raw = await fs.readFile(path.join(DATA_DIR, file), 'utf8');
        const w = JSON.parse(raw);
        workflows.push({
          id: w.id,
          name: w.name,
          description: w.description,
          category: w.category,
          updatedAt: w.updatedAt,
        });
      } catch {}
    }
    workflows.sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return NextResponse.json(workflows);
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(req: Request) {
  await ensureDir();
  const body = await req.json();
  const id = uuid();
  const now = new Date().toISOString();
  const workflow = {
    id,
    name: body.name || 'Untitled Workflow',
    description: body.description || '',
    category: body.category || 'general',
    nodes: [],
    edges: [],
    createdAt: now,
    updatedAt: now,
  };
  await fs.writeFile(path.join(DATA_DIR, `${id}.json`), JSON.stringify(workflow, null, 2));
  return NextResponse.json(workflow);
}
