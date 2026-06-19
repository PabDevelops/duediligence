import cron from 'node-cron';

let schedulerInitialized = false;

export function initializeScheduler() {
  if (schedulerInitialized) return;
  schedulerInitialized = true;

  // Run auto-post-educational every day at 8:03 AM
  cron.schedule('3 8 * * *', async () => {
    console.log('[Scheduler] Running auto-post-educational...');
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/admin/auto-post-educational`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Cron-Secret': process.env.CRON_SECRET || '',
        },
      });

      const result = await response.json();
      console.log('[Scheduler] Auto-post result:', result);
    } catch (error) {
      console.error('[Scheduler] Error running auto-post-educational:', error);
    }
  });

  console.log('[Scheduler] Initialized: auto-post-educational at 8:03 AM daily');
}
