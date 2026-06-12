/**
 * Next.js instrumentation hook — runs once when the server process boots.
 * Starts the background scheduler (scheduled-post publishing + metrics sync).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startScheduler } = await import('./lib/scheduler');
    startScheduler();
  }
}
