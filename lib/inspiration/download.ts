/**
 * Tải video công khai từ IG/FB/TikTok/YouTube về IMAGES_DIR bằng yt-dlp
 * (Dockerfile cài `apk add yt-dlp`). Host allowlist chống SSRF — chỉ các
 * platform mạng xã hội được phép; mọi URL khác từ chối thẳng.
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { IMAGES_DIR } from '../video/ffmpeg';

const ALLOWED_HOSTS = new Set([
  'instagram.com', 'www.instagram.com',
  'facebook.com', 'www.facebook.com', 'm.facebook.com', 'fb.watch', 'web.facebook.com',
  'tiktok.com', 'www.tiktok.com', 'vt.tiktok.com', 'vm.tiktok.com',
  'youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com',
]);

export function isAllowedSourceUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && ALLOWED_HOSTS.has(u.hostname.toLowerCase());
  } catch { return false; }
}

/** Tải CHỈ AUDIO từ link video/reel (kho nhạc nền) → trả filename mp3 trong IMAGES_DIR. */
export async function downloadSourceAudio(url: string, id: string): Promise<string> {
  if (!isAllowedSourceUrl(url)) {
    throw new Error('URL không hợp lệ — chỉ nhận link công khai Instagram / Facebook / TikTok / YouTube (https).');
  }
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  const filename = `bgm_${id}.mp3`;
  const out = path.join(IMAGES_DIR, filename);

  await new Promise<void>((resolve, reject) => {
    const proc = spawn('yt-dlp', [
      '--no-playlist', '--max-filesize', '100m', '--socket-timeout', '30',
      '-x', '--audio-format', 'mp3', '--audio-quality', '192K',
      '-o', out,
      url,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });

    let stderr = '';
    proc.stderr.on('data', d => { stderr += String(d); });
    const timer = setTimeout(() => { proc.kill('SIGKILL'); reject(new Error('Tải nhạc quá 3 phút — thử lại hoặc upload file mp3.')); }, 180_000);
    proc.on('error', (e: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      reject(e.code === 'ENOENT'
        ? new Error('Server chưa cài yt-dlp — hãy upload file nhạc trực tiếp.')
        : e);
    });
    proc.on('close', code => {
      clearTimeout(timer);
      if (code === 0 && fs.existsSync(out)) resolve();
      else reject(new Error(`Không tải được nhạc (yt-dlp exit ${code}). Link có thể private/bị chặn — thử upload file. ${stderr.slice(-300)}`));
    });
  });
  return filename;
}

/** Tải video → trả filename trong IMAGES_DIR. Throw với message tiếng Việt khi fail. */
export async function downloadSourceVideo(url: string, id: string): Promise<string> {
  if (!isAllowedSourceUrl(url)) {
    throw new Error('URL không hợp lệ — chỉ nhận link công khai Instagram / Facebook / TikTok / YouTube (https).');
  }
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  const filename = `insp_${id}.mp4`;
  const out = path.join(IMAGES_DIR, filename);

  await new Promise<void>((resolve, reject) => {
    const proc = spawn('yt-dlp', [
      '--no-playlist', '--max-filesize', '300m', '--socket-timeout', '30',
      '-f', 'mp4[height<=1920]/best[height<=1920]/best',
      '--recode-video', 'mp4',
      '-o', out,
      url,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });

    let stderr = '';
    proc.stderr.on('data', d => { stderr += String(d); });
    const timer = setTimeout(() => { proc.kill('SIGKILL'); reject(new Error('Tải video quá 3 phút — thử lại hoặc upload file trực tiếp.')); }, 180_000);
    proc.on('error', (e: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      reject(e.code === 'ENOENT'
        ? new Error('Server chưa cài yt-dlp — hãy upload file video trực tiếp.')
        : e);
    });
    proc.on('close', code => {
      clearTimeout(timer);
      if (code === 0 && fs.existsSync(out)) resolve();
      else reject(new Error(`Không tải được video (yt-dlp exit ${code}). Link có thể private/bị chặn — thử upload file trực tiếp. ${stderr.slice(-300)}`));
    });
  });
  return filename;
}
