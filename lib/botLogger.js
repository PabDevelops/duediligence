import { supabase } from './supabase';

// Fire-and-forget insert of a detected AI crawler visit. Uses the service-role
// client because bot_crawler_logs has RLS enabled and the anon key can't write to it.
export async function logBotVisit({ path, botName, userAgent, referrer }) {
  try {
    const { error } = await supabase.from('bot_crawler_logs').insert({
      path,
      bot_name: botName,
      user_agent: userAgent,
      referrer: referrer || null,
    });
    if (error) console.error('bot_crawler_logs insert failed:', error.message);
  } catch (err) {
    console.error('bot_crawler_logs insert threw:', err);
  }
}
