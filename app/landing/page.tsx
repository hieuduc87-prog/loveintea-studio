// Public marketing landing — served at easycreativehub.com (root host rewrite).
import type { Metadata } from 'next';
import { LandingPage } from '@/components/LandingPage';
import './landing.css';

export const metadata: Metadata = {
  title: 'Easy Creative Hub — Marketing OS chạy bằng AI cho thương hiệu',
  description: 'AI viết caption, tạo ảnh, dựng video, đăng bài FB/IG tự động và tự học từ số liệu. Strategy → Content → Publish → Learn trong một nền tảng duy nhất.',
  openGraph: {
    title: 'Easy Creative Hub — Marketing OS chạy bằng AI',
    description: 'Cỗ máy content chạy bằng AI cho thương hiệu của bạn.',
    images: ['/brand/landing/hero-visual.jpg'],
  },
};

export default function Landing() {
  return <LandingPage />;
}
