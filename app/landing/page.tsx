// Public marketing landing — served at easycreativehub.com (root host rewrite).
import type { Metadata } from 'next';
import { LandingPage } from '@/components/LandingPage';
import './landing.css';

export const metadata: Metadata = {
  title: 'Easy Creative Hub — AI + Đội ngũ marketing chuyên gia lên plan cho thương hiệu Việt',
  description: 'Không phó thác 100% cho AI. Đội ngũ chuyên gia marketing lên plan, AI tăng tốc thực thi — caption, ảnh, video, đăng bài FB/IG. Chuẩn agency, tối ưu cho shop D2C Việt Nam.',
  openGraph: {
    title: 'Easy Creative Hub — AI + Chuyên gia Marketing',
    description: 'Đội ngũ marketing chuyên gia + AI thực thi. Không phải phó mặc cho AI — có người review từng plan, từng bài.',
    images: ['/brand/landing/hero-visual.jpg'],
  },
};

export default function Landing() {
  return <LandingPage />;
}
