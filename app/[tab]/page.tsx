import { AppShell } from '@/components/AppShell';

// Clean link routing: /video-studio, /products, /plan-calendar … → tab id (snake_case)
export default function TabPage({
  params, searchParams,
}: {
  params: { tab: string };
  searchParams: { fb_success?: string; fb_error?: string };
}) {
  const tabId = params.tab.replace(/-/g, '_');
  return <AppShell initialTab={tabId} fbSuccess={!!searchParams.fb_success} fbError={searchParams.fb_error} />;
}
