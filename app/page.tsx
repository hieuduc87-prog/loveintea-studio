import { AppShell } from '@/components/AppShell';

export default function Home({ searchParams }: { searchParams: { tab?: string; fb_success?: string; fb_error?: string } }) {
  // Root = dashboard; ?tab= kept for backward-compat links
  return <AppShell initialTab={searchParams.tab || 'dashboard'} fbSuccess={!!searchParams.fb_success} fbError={searchParams.fb_error} />;
}
