import cron from 'node-cron';

let schedulerInitialized = false;

export function initializeScheduler() {
  if (schedulerInitialized) return;
  schedulerInitialized = true;

  // Run auto-post-movers every day at 8:03 AM
  cron.schedule('3 8 * * *', async () => {
    console.log('[Scheduler] Running auto-post-movers...');
    try {
      const response = await fetch('http://localhost:3000/api/admin/auto-post-movers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': process.env.ADMIN_TOKEN || 'development',
        },
      });

      const result = await response.json();
      console.log('[Scheduler] Auto-post result:', result);
    } catch (error) {
      console.error('[Scheduler] Error running auto-post-movers:', error);
    }
  });

  console.log('[Scheduler] Initialized: auto-post-movers at 8:03 AM daily');
}
