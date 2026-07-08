// Platform (super-admin) console — separate route, gated to admins by middleware.
import { PlatformConsole } from '@/components/PlatformConsole';

export const dynamic = 'force-dynamic';

export default function PlatformPage() {
  return <PlatformConsole />;
}
