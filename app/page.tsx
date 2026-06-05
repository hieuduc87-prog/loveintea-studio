import { AppShell } from '@/components/AppShell';

export default function Home({ searchParams }: { searchParams: { tab?: string; fb_success?: string; fb_error?: string } }) {
  return <AppShell initialTab={searchParams.tab} fbSuccess={!!searchParams.fb_success} fbError={searchParams.fb_error} />;
}
