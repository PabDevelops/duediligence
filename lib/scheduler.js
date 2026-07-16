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

  // Keep the Explore page's curated thematic/industry ticker baskets warm in stock_cache,
  // so they show fully populated on first view instead of filling in over several page loads.
  cron.schedule('30 6 * * *', async () => {
    console.log('[Scheduler] Running seed-tickers...');
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/admin/seed-tickers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Cron-Secret': process.env.CRON_SECRET || '',
        },
        body: JSON.stringify({}),
      });

      const result = await response.json();
      console.log('[Scheduler] Seed-tickers result:', result);
    } catch (error) {
      console.error('[Scheduler] Error running seed-tickers:', error);
    }
  });

  // Pre-warm stock_cache for every ticker with an upcoming earnings date (see comment in
  // app/api/admin/seed-earnings-calendar/route.js), so the Calendar page doesn't rely on
  // enough real users clicking each of ~1800+ events to populate the cache. Runs before the
  // Explore seed job so both are done well ahead of typical morning traffic.
  cron.schedule('0 3 * * *', async () => {
    console.log('[Scheduler] Running seed-earnings-calendar...');
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/admin/seed-earnings-calendar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Cron-Secret': process.env.CRON_SECRET || '',
        },
      });

      const result = await response.json();
      console.log('[Scheduler] Seed-earnings-calendar result:', result);
    } catch (error) {
      console.error('[Scheduler] Error running seed-earnings-calendar:', error);
    }
  });

  console.log('[Scheduler] Initialized: auto-post-educational at 8:03 AM daily, seed-earnings-calendar at 3:00 AM daily, seed-tickers at 6:30 AM daily');
}
