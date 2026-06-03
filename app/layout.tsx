import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LoveinTea Studio — Content Management',
  description: 'Content production, scheduling & publishing for LoveinTea',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
